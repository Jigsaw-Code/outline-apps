// Copyright 2018 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.Serialization;
using System.Security.AccessControl;
using System.Security.Principal;
using System.ServiceProcess;
using System.Text;
using Newtonsoft.Json;

/*
 * Windows Service, part of the Outline Windows client, to configure routing.
 * Modifying the system routes requires admin permissions, so this service must be installed
 * and started as admin.
 *
 * The service listens on a named pipe and supports the following JSON API:
 *
 * Requests
 *
 * configureRouting: Modifies the system's routing table to route all traffic through `routerIp`,
 *    allowing only `proxyIp` to bypass it. Disables IPv6 traffic.
 *    { action: "configureRouting", parameters: {"proxyIp": <IPv4 address>, "routerIp": <IPv4 address>,
 *                                               "isAutoConnect": "false" }
 *    }
 *
 *  resetRouting: Restores the system's default routing.
 *    { action: "resetRouting"}
 *
 * Response
 *
 *  { statusCode: <int>, errorMessage?: <string> }
 *
 */
namespace OutlineService
{
    public partial class OutlineService : ServiceBase
    {
        private const string EVENT_LOG_SOURCE = "OutlineService";
        private const string EVENT_LOG_NAME = "Application";
        // Must be kept in sync with the Electron code.
        private const string PIPE_NAME = "OutlineServicePipe";
        private const string TAP_DEVICE_NAME = "outline-tap0";

        private const string ACTION_CONFIGURE_ROUTING = "configureRouting";
        private const string ACTION_RESET_ROUTING = "resetRouting";
        private const string PARAM_ROUTER_IP = "routerIp";
        private const string PARAM_PROXY_IP = "proxyIp";
        private const string PARAM_AUTO_CONNECT = "isAutoConnect";

        private static string[] IPV4_SUBNETS = { "0.0.0.0/1", "128.0.0.0/1" };
        private static string[] IPV6_SUBNETS = { "fc00::/7", "2000::/4", "3000::/4" };
        private static string[] IPV4_RESERVED_SUBNETS = {
            "0.0.0.0/8",
            "10.0.0.0/8",
            "100.64.0.0/10",
            "127.0.0.0/8",
            "169.254.0.0/16",
            "172.16.0.0/12",
            "192.0.0.0/24",
            "192.0.2.0/24",
            "192.31.196.0/24",
            "192.52.193.0/24",
            "192.88.99.0/24",
            "192.168.0.0/16",
            "192.175.48.0/24",
            "198.18.0.0/15",
            "198.51.100.0/24",
            "203.0.113.0/24",
            "240.0.0.0/4"
        };
        private const string CMD_NETSH = "netsh";

        private const uint BUFFER_SIZE_BYTES = 1024;

        private EventLog eventLog;
        private NamedPipeServerStream pipe;
        private string proxyIp;
        private string routerIp;
        private IPAddress gatewayIp;
        private string gatewayInterfaceName;

        // Time, in ms, to wait until considering smartdnsblock.exe to have successfully launched.
        private const int SMART_DNS_BLOCK_TIMEOUT_MS = 1000;

        // Do as little as possible here because any error thrown will cause "net start" to fail
        // without anything being added to the application log.
        public OutlineService()
        {
            InitializeComponent();

            eventLog = new EventLog();
            if (!EventLog.SourceExists(EVENT_LOG_SOURCE))
            {
                EventLog.CreateEventSource(EVENT_LOG_SOURCE, EVENT_LOG_NAME);
            }
            eventLog.Source = EVENT_LOG_SOURCE;
            eventLog.Log = EVENT_LOG_NAME;
        }

        protected override void OnStart(string[] args)
        {
            eventLog.WriteEntry("OutlineService starting");
            NetworkChange.NetworkAddressChanged +=
                new NetworkAddressChangedEventHandler(NetworkAddressChanged);
            CreatePipe();
            pipe.BeginWaitForConnection(HandleConnection, null);
        }

        protected override void OnStop()
        {
            eventLog.WriteEntry("OutlineService stopping");
            DestroyPipe();
            NetworkChange.NetworkAddressChanged -= NetworkAddressChanged;
        }

        private void CreatePipe()
        {
            var pipeSecurity = new PipeSecurity();
            pipeSecurity.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(
                WellKnownSidType.CreatorOwnerSid, null),
                PipeAccessRights.FullControl, AccessControlType.Allow));
            pipeSecurity.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(
                WellKnownSidType.AuthenticatedUserSid, null),
                PipeAccessRights.ReadWrite, AccessControlType.Allow));

            pipe = new NamedPipeServerStream(PIPE_NAME, PipeDirection.InOut, -1, PipeTransmissionMode.Message,
                                             PipeOptions.Asynchronous, (int)BUFFER_SIZE_BYTES, (int)BUFFER_SIZE_BYTES, pipeSecurity);
        }

        private void DestroyPipe()
        {
            if (pipe == null)
            {
                return;
            }
            try
            {
                if (pipe.IsConnected)
                {
                    pipe.Disconnect();
                }
                pipe.Close();
                pipe = null;
            }
            catch (Exception e)
            {
                eventLog.WriteEntry($"Got an exception while destroying the pipe: {e.ToString()}",
                                    EventLogEntryType.Warning);
            }
        }

        private void HandleConnection(IAsyncResult result)
        {
            eventLog.WriteEntry("Got incoming connection");

            // Save the network config before we do anything. If the request fails
            // it will be sent to the client for inclusion in Sentry reports.
            var beforeNetworkInfo = GetNetworkInfo();

            try
            {
                pipe.EndWaitForConnection(result);
                ServiceResponse response = new ServiceResponse();
                var request = ReadRequest();
                if (request == null)
                {
                    response.statusCode = 1;
                }
                else
                {
                    try
                    {
                        HandleRequest(request);
                    }
                    catch (Exception e)
                    {
                        var statusCode = e is UnsupportedRoutingTableException ? ErrorCode.UnsupportedRoutingTable
                                                                               : ErrorCode.GenericFailure;
                        response.statusCode = (int)statusCode;
                        response.errorMessage = $"{e.Message} (network config: {beforeNetworkInfo})";
                    }
                }
                WriteResponse(response);
            }
            catch (Exception e)
            {
                eventLog.WriteEntry($"Failed to handle connection: {e.ToString()}", EventLogEntryType.Error);
            }
            finally
            {
                // Pipe streams are one-to-one connections. Recreate the pipe to handle subsequent requests.
                DestroyPipe();
                CreatePipe();
                pipe.BeginWaitForConnection(HandleConnection, null);
            }
        }

        private ServiceRequest ReadRequest()
        {
            var stringBuilder = new StringBuilder();
            var buffer = new byte[BUFFER_SIZE_BYTES];
            var memoryStream = new MemoryStream();
            do
            {
                var readBytes = pipe.Read(buffer, 0, buffer.Length);
                memoryStream.Write(buffer, 0, readBytes);
            } while (!pipe.IsMessageComplete);
            var msg = Encoding.UTF8.GetString(buffer);
            if (String.IsNullOrWhiteSpace(msg))
            {
                eventLog.WriteEntry("Failed to read request", EventLogEntryType.Error);
                return null;
            }
            eventLog.WriteEntry($"Got message: {msg}");
            return ParseRequest(msg);
        }

        private ServiceRequest ParseRequest(string jsonRequest)
        {
            try
            {
                return JsonConvert.DeserializeObject<ServiceRequest>(jsonRequest);
            }
            catch (Exception e)
            {
                eventLog.WriteEntry($"Failed to parse request: {e.ToString()}");
            }
            return null;
        }

        private void WriteResponse(ServiceResponse response)
        {
            var jsonResponse = SerializeResponse(response);
            if (jsonResponse == null)
            {
                eventLog.WriteEntry("Failed to serialize response.", EventLogEntryType.Error);
                return;
            }
            var jsonResponseBytes = Encoding.UTF8.GetBytes(jsonResponse);
            pipe.Write(jsonResponseBytes, 0, jsonResponseBytes.Length);
            pipe.Flush();
            pipe.WaitForPipeDrain();
        }

        private string SerializeResponse(ServiceResponse response)
        {
            try
            {
                return JsonConvert.SerializeObject(response);
            }
            catch (Exception e)
            {
                eventLog.WriteEntry($"Failed to serialize response: {e.ToString()}");
            }
            return null;
        }

        private void HandleRequest(ServiceRequest request)
        {
            switch (request.action)
            {
                case ACTION_CONFIGURE_ROUTING:
                    ConfigureRouting(
                        request.parameters[PARAM_ROUTER_IP], request.parameters[PARAM_PROXY_IP],
                        Boolean.Parse(request.parameters[PARAM_AUTO_CONNECT]));
                    break;
                case ACTION_RESET_ROUTING:
                    ResetRouting(proxyIp, gatewayInterfaceName);
                    break;
                default:
                    eventLog.WriteEntry($"Received invalid request: {request.action}", EventLogEntryType.Error);
                    break;
            }
        }

        // Routes all device traffic through the router, at IP address `routerIp`. The proxy's IP is configured
        // to bypass the router, and connect through the system's default gateway.
        //
        // Throws and exits early if any step fails, other than bypassing reserved subnets.
        public void ConfigureRouting(string routerIp, string proxyIp, bool isAutoConnect)
        {
            if (routerIp == null || proxyIp == null)
            {
                throw new Exception("do not know router or proxy IPs");
            }

            StartSmartDnsBlock();

            // Proxy routing: the proxy's IP address needs to bypass the router. Save the system gateway
            // before we add the route. This is necessary for updating the proxy route when the network
            // changes; otherwise we get the TAP device as default system gateway.
            try
            {
                var systemGateway = GetSystemIpv4Gateway();
                SetGatewayProperties(systemGateway);
            }
            catch (Exception e) when (isAutoConnect && e is NoDefaultGatewayFoundException)
            {
                // Allow the connection to proceed if there is no network connectivity during auto connect.
            }

            if (gatewayIp != null)
            {
                var gatewayIpStr = gatewayIp.ToString();
                try
                {
                    AddProxyRoute(proxyIp, gatewayIpStr, gatewayInterfaceName);
                }
                catch (Exception e)
                {
                    throw new Exception($"could not add route to proxy server: {e.Message}");
                }
                // Route IPv4 traffic through the router and bypass reserved subnets
                // only if there is network connectivity.
                AddIpv4Redirect(routerIp);
                AddReservedSubnetBypass(gatewayIpStr, gatewayInterfaceName);
            }
            StopRoutingIpv6();

            // Save the IPs so we can reset routing.
            this.proxyIp = proxyIp;
            this.routerIp = routerIp;
        }

        // Resets the routing table:
        //  - remove route to the proxy server (if we know its IP)
        //  - remove our default IPv4 gateways
        //  - re-enable IPv6
        //
        // Does *not* throw or exit early if any step fails: keeps going!
        public void ResetRouting(string proxyIp, string proxyInterfaceName)
        {
            // Proxy server.
            if (proxyIp != null)
            {
                try
                {
                    DeleteProxyRoute(proxyIp, proxyInterfaceName);
                }
                catch (Exception e)
                {
                    eventLog.WriteEntry($"failed to remove route to the proxy server: {e.Message}",
                        EventLogEntryType.Warning);
                }
            }
            else
            {
                eventLog.WriteEntry("cannot remove route to proxy server, have not previously set",
                    EventLogEntryType.Warning);
            }

            this.proxyIp = null;
            SetGatewayProperties(null);

            // Restore system routes.
            RemoveIpv4Redirect();
            RemoveReservedSubnetBypass(proxyInterfaceName);
            StartRoutingIpv6();

            try
            {
                StopSmartDnsBlock();
            }
            catch (Exception e)
            {
                eventLog.WriteEntry($"failed to lift Smart DNS block: {e.Message}",
                    EventLogEntryType.Warning);
            }
        }

        // Disable "Smart Multi-Homed Name Resolution", to ensure the system uses only the
        // (non-filtered) DNS server(s) associated with the TAP device.
        //
        // Notes:
        //  - To show the current firewall rules:
        //      netsh wfp show filters
        //  - This website is an easy way to quickly verify there are no DNS leaks:
        //      https://ipleak.net/
        //  - Because .Net provides *no way* to associate the new process with this one, the
        //    new process will continue to run even if this service is interrupted or crashes.
        //    Fortunately, since the changes it makes are *not* persistent, the system can, in
        //    the worst case, be fixed by rebooting.
        private void StartSmartDnsBlock()
        {
            // smartdnsblock.exe must be a sibling of OutlineService.exe.
            Process smartDnsBlock = new Process();
            smartDnsBlock.StartInfo.FileName = new DirectoryInfo(Process.GetCurrentProcess().MainModule.FileName).Parent.FullName +
                Path.DirectorySeparatorChar + "smartdnsblock.exe";
            smartDnsBlock.StartInfo.UseShellExecute = false;

            smartDnsBlock.StartInfo.RedirectStandardError = true;
            smartDnsBlock.StartInfo.RedirectStandardOutput = true;

            ArrayList stdout = new ArrayList();
            ArrayList stderr = new ArrayList();
            smartDnsBlock.OutputDataReceived += (object sender, DataReceivedEventArgs e) =>
            {
                if (!String.IsNullOrEmpty(e.Data))
                {
                    stdout.Add(e.Data);
                }
            };
            smartDnsBlock.ErrorDataReceived += (object sender, DataReceivedEventArgs e) =>
            {
                if (!String.IsNullOrEmpty(e.Data))
                {
                    stderr.Add(e.Data);
                }
            };

            try
            {
                smartDnsBlock.Start();
                smartDnsBlock.BeginOutputReadLine();
                smartDnsBlock.BeginErrorReadLine();
            }
            catch (Exception e)
            {
                throw new Exception($"could not launch smartdnsblock at {smartDnsBlock.StartInfo.FileName}: { e.Message}");
            }

            // This does *not* throw if the process is still running after Nms.
            smartDnsBlock.WaitForExit(SMART_DNS_BLOCK_TIMEOUT_MS);
            if (smartDnsBlock.HasExited)
            {
                throw new Exception($"smartdnsblock failed " + $"(stdout: {String.Join(Environment.NewLine, stdout.ToArray())}, " +
                    $"(stderr: {String.Join(Environment.NewLine, stderr.ToArray())})");
            }
        }

        private void StopSmartDnsBlock()
        {
            try
            {
                RunCommand("powershell", "stop-process -name smartdnsblock");
            }
            catch (Exception e)
            {
                throw new Exception($"could not kill smartdnsblock: {e.Message}");
            }
        }

        private void AddProxyRoute(string proxyIp, string systemGatewayIp, string interfaceName)
        {
            try
            {
                RunCommand(CMD_NETSH,
                    $"interface ipv4 add route {proxyIp}/32 nexthop={systemGatewayIp} interface=\"{interfaceName}\" metric=0");
            }
            catch (Exception)
            {
                // If "add" fails, it's possible there's already a route to this proxy
                // server from a previous run of Outline which ResetRouting could
                // not remove; try "set" before failing.
                RunCommand(CMD_NETSH,
                     $"interface ipv4 set route {proxyIp}/32 nexthop={systemGatewayIp} interface=\"{interfaceName}\" metric=0");
            }
        }

        private void DeleteProxyRoute(string proxyIp, string interfaceName)
        {
            RunCommand(CMD_NETSH, $"interface ipv4 delete route {proxyIp}/32 interface=\"{interfaceName}\"");
        }

        // Route IPv4 traffic through the router. Instead of deleting the default IPv4 gateway (0.0.0.0/0),
        // we resort to creating two more specific routes (see IPV4_SUBNETS) that take precedence over the
        // default gateway. This way, we need not worry about the default gateway being recreated with a lower
        // metric upon device sleep. This 'hack' was inspired by OpenVPN;
        // see https://github.com/OpenVPN/openvpn3/commit/d08cc059e7132a3d3aee3dcd946fce4c35b1ced3#diff-1d76f0fd7ec04c6d1398288214a879c5R358.
        private void AddIpv4Redirect(string routerIp)
        {
            try
            {
                foreach (string subnet in IPV4_SUBNETS)
                {
                    RunCommand(CMD_NETSH, $"interface ipv4 add route {subnet} nexthop={routerIp} interface={TAP_DEVICE_NAME} metric=0");
                }
            }
            catch (Exception e)
            {
                throw new Exception($"could not change default gateway: {e.Message}");
            }
        }

        private void RemoveIpv4Redirect()
        {
            foreach (string subnet in IPV4_SUBNETS)
            {
                try
                {
                    RunCommand(CMD_NETSH, $"interface ipv4 delete route {subnet} interface={TAP_DEVICE_NAME}");
                }
                catch (Exception e)
                {
                    eventLog.WriteEntry($"failed to remove {subnet}: {e.Message}", EventLogEntryType.Error);
                }
            }
        }

        private void StartRoutingIpv6()
        {
            foreach (string subnet in IPV6_SUBNETS)
            {
                try
                {
                    RunCommand(CMD_NETSH, $"interface ipv6 delete route {subnet} interface={NetworkInterface.IPv6LoopbackInterfaceIndex}");
                }
                catch (Exception e)
                {
                    eventLog.WriteEntry($"failed to remove {subnet}: {e.Message}", EventLogEntryType.Error);
                }
            }
        }

        // Outline does not currently support IPv6, so we resort to disabling it while the VPN is active to
        // prevent leakage. Removing the default IPv6 gateway is not enough since it gets re-created
        // through router advertisements and DHCP (disabling these or IPv6 routing altogether requires a
        // system reboot). Thus, we resort to creating three IPv6 routes (see IPV6_SUBNETS) to the loopback
        // interface that are more specific than the default route, causing IPv6 traffic to get dropped.
        private void StopRoutingIpv6()
        {
            try
            {
                foreach (string subnet in IPV6_SUBNETS)
                {
                    RunCommand(CMD_NETSH, $"interface ipv6 add route {subnet} interface={NetworkInterface.IPv6LoopbackInterfaceIndex} metric=0");
                }
            }
            catch (Exception e)
            {
                throw new Exception($"could not disable IPv6: {e.Message}");
            }
        }

        // Routes reserved and private subnets through the default gateway so they bypass the VPN.
        private void AddReservedSubnetBypass(string systemGatewayIp, string interfaceName)
        {
            try
            {
                foreach (string subnet in IPV4_RESERVED_SUBNETS)
                {
                    RunCommand(CMD_NETSH,
                      $"interface ipv4 add route {subnet} nexthop={systemGatewayIp} interface=\"{interfaceName}\" metric=0");
                }
            }
            catch (Exception e)
            {
                eventLog.WriteEntry($"Failed to bypass reserved subnets: {e.Message}");
            }
        }

        // Removes reserved subnet routes created to bypass the VPN.
        private void RemoveReservedSubnetBypass(string interfaceName)
        {
            try
            {
                foreach (string subnet in IPV4_RESERVED_SUBNETS)
                {
                    RunCommand(CMD_NETSH, $"interface ipv4 delete route {subnet} interface=\"{interfaceName}\"");
                }
            }
            catch (Exception e)
            {
                eventLog.WriteEntry($"Failed to remove reserved subnets bypass: {e.Message}");
            }
        }

        // Runs a shell command synchronously.
        private void RunCommand(string cmd, string args)
        {
            Console.WriteLine($"running command: {cmd} {args}");

            var startInfo = new ProcessStartInfo(cmd);
            startInfo.Arguments = args;
            startInfo.UseShellExecute = false;
            startInfo.RedirectStandardError = true;
            startInfo.RedirectStandardOutput = true;
            startInfo.CreateNoWindow = true;

            Process p = new Process();
            var stdout = new StringBuilder();
            var stderr = new StringBuilder();
            p.OutputDataReceived += (object sender, DataReceivedEventArgs e) =>
            {
                if (e == null || String.IsNullOrWhiteSpace(e.Data))
                {
                    return;
                }
                stdout.Append(e.Data);
            };
            p.ErrorDataReceived += (object sender, DataReceivedEventArgs e) =>
            {
                if (e == null || String.IsNullOrWhiteSpace(e.Data))
                {
                    return;
                }
                stderr.Append(e.Data);
            };
            p.StartInfo = startInfo;
            p.Start();
            p.BeginOutputReadLine();
            p.BeginErrorReadLine();
            p.WaitForExit();

            if (p.ExitCode != 0)
            {
                // NOTE: Do *not* add args to this error message because it's piped
                //       back to the client for inclusion in Sentry reports and
                //       effectively contain access keys.
                throw new Exception($"command exited with {p.ExitCode} " +
                    $"(stdout: {stdout.ToString()}, stderr: {stderr.ToString()})");
            }
        }

        // Queries the system's IPv4 network configuration, returning the system's active IPv4 gateway
        // interface iff we think we can modify the routing to route via Outline.
        // Otherwise, throws with a description of the problem, e.g. system has multiple gateways.
        private NetworkInterface GetSystemIpv4Gateway()
        {
            // Find network interfaces with IPv4 gateways.
            //
            // Notes:
            //  - Ignore outline-tap0 as in certain rare situations - tun2socks crash? - it can
            //    have a "phantom" gateway from previous connection attempt(s) which "re-appears"
            //    in the routing table only once tun2socks restarts (so it doesn't get nuked by the
            //    client's call to ResetRouting).
            //  - Ignore inactive interfaces as they may have gateways, yet are unable to route traffic.
            var interfacesWithIpv4Gateways = NetworkInterface.GetAllNetworkInterfaces()
                .Where(i => i.Name != TAP_DEVICE_NAME)
                .Where(i => i.OperationalStatus == OperationalStatus.Up)
                .Where(i => i.GetIPProperties().GatewayAddresses
                    .Select(g => g.Address)
                    .Where(a => a.AddressFamily == AddressFamily.InterNetwork).Count() > 0);

            // Ensure there is only one interface with IPv4 gateways.
            if (interfacesWithIpv4Gateways.Count() < 1)
            {
                throw new NoDefaultGatewayFoundException("no interface has an IPv4 gateway");
            }
            else if (interfacesWithIpv4Gateways.Count() > 1)
            {
                throw new UnsupportedRoutingTableException("multiple interfaces have IPv4 gateways: " +
                    $"{String.Join(", ", interfacesWithIpv4Gateways.Select(i => i.Name))}");
            }

            // TODO: When we find multiple interfaces with IPv4 gateways, guess which one is active by,
            //       for example, choosing the one with the lowest device metric.
            return interfacesWithIpv4Gateways.First();
        }

        private void SetGatewayProperties(NetworkInterface gateway)
        {
            gatewayIp = gateway != null ? GetInterfaceGatewayIpv4(gateway) : null;
            gatewayInterfaceName = gateway != null ? gateway.Name : null;
        }

        private IPAddress GetInterfaceGatewayIpv4(NetworkInterface networkInterface)
        {
            // Though it's unclear how an interface could have multiple gateway addresses,
            // pick the first one.
            return networkInterface.GetIPProperties().GatewayAddresses
                  .Select(g => g.Address)
                  .Where(a => a.AddressFamily == AddressFamily.InterNetwork)
                  .First();
        }

        // TODO: Notify the UI of failures here - they could leave the system in a broken state.
        private void NetworkAddressChanged(object sender, EventArgs evt)
        {
            if (proxyIp == null)
            {
                eventLog.WriteEntry("Network change but Outline is not connected, nothing to do.");
                return;
            }

            NetworkInterface newGateway = null;
            try
            {
                newGateway = GetSystemIpv4Gateway();
            }
            catch (Exception e)
            {
                if (e is NoDefaultGatewayFoundException)
                {
                    eventLog.WriteEntry("No network connectivity, disabling IPv4 routing.");
                    RemoveIpv4Redirect();
                }
                else
                {
                    eventLog.WriteEntry($"Unsupported routing table after network change: {e.Message}");
                }
                return;
            }
            var newGatewayIp = GetInterfaceGatewayIpv4(newGateway);
            var newGatewayInterfaceName = newGateway.Name;
            eventLog.WriteEntry($"Network change: ({gatewayIp}, {gatewayInterfaceName}) -> " +
                                $"({newGatewayIp}, {newGatewayInterfaceName})");
            if (newGatewayIp.Equals(gatewayIp) && newGatewayInterfaceName == gatewayInterfaceName)
            {
                eventLog.WriteEntry("No route change required.");
                // Re-enable IPv4 routing in case it was disabled and the same interface used by the proxy
                // route came back up. Ignore errors, as the routes may already exist.
                try
                {
                    AddIpv4Redirect(routerIp);
                }
                catch (Exception) { }
                return;
            }

            // Update the proxy route with the new gateway.
            try
            {
                DeleteProxyRoute(proxyIp, gatewayInterfaceName);
            }
            catch (Exception)
            {
                eventLog.WriteEntry("Failed to delete the route to the proxy after a network change.",
                                    EventLogEntryType.Error);
            }
            try
            {
                AddProxyRoute(proxyIp, newGatewayIp.ToString(), newGatewayInterfaceName);
            }
            catch (Exception)
            {
                eventLog.WriteEntry("Failed to add the route to the proxy after a network change.",
                                    EventLogEntryType.Error);
            }

            // Update the reserved subnet bypass to use the new gateway.
            RemoveReservedSubnetBypass(gatewayInterfaceName);
            AddReservedSubnetBypass(newGatewayIp.ToString(), newGatewayInterfaceName);

            // Re-enable IPv4 routing and store the new gateway properties.
            try
            {
                AddIpv4Redirect(routerIp);
            }
            catch (Exception)
            {
                eventLog.WriteEntry("Failed to configure IPv4 routes", EventLogEntryType.Error);
            }
            SetGatewayProperties(newGateway);
        }

        public string GetNetworkInfo()
        {
            return String.Join(", ", NetworkInterface.GetAllNetworkInterfaces()
                .Select(a => this.GetAdapterInfo(a)));
        }

        private string GetAdapterInfo(NetworkInterface adapter)
        {
            var numIpv4Gateways = adapter.GetIPProperties().GatewayAddresses
                  .Select(g => g.Address)
                  .Where(a => a.AddressFamily == AddressFamily.InterNetwork)
                  .Count();
            var numIpv6Gateways = adapter.GetIPProperties().GatewayAddresses
                  .Select(g => g.Address)
                  .Where(a => a.AddressFamily == AddressFamily.InterNetworkV6)
                  .Count();

            return $"{adapter.Name} ({adapter.OperationalStatus}): " + (
                adapter.Supports(NetworkInterfaceComponent.IPv4) ?
                    $"{numIpv4Gateways} x ipv4 gateways" :
                    "ipv4 disabled") + ", " + (
                adapter.Supports(NetworkInterfaceComponent.IPv6) ?
                    $"{numIpv6Gateways} x ipv6 gateways" :
                    "ipv6 disabled");
        }
    }

    [DataContract]
    internal class ServiceRequest
    {
        [DataMember]
        internal string action;
        [DataMember]
        internal Dictionary<string, string> parameters;
    }

    [DataContract]
    internal class ServiceResponse
    {
        [DataMember]
        internal int statusCode;
        [DataMember]
        internal string errorMessage;
    }

    public enum ErrorCode
    {
        Success = 0,
        GenericFailure = 1,
        UnsupportedRoutingTable = 2
    }

    internal class UnsupportedRoutingTableException : Exception
    {
        public UnsupportedRoutingTableException(string message) : base(message) { }
    }

    internal class NoDefaultGatewayFoundException : UnsupportedRoutingTableException
    {
        public NoDefaultGatewayFoundException(string message) : base(message) { }
    }
}
