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
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Net.NetworkInformation;
using System.ServiceProcess;
using System.Security.AccessControl;
using System.Text;
using System.Collections.Generic;
using Newtonsoft.Json;
using System.Linq;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Net;
using System.Runtime.Serialization;

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
 *    { action: "configureRouting", parameters: {"proxyIp": <IPv4 address>, "routerIp: <IPv4 address> }
 *
 *  resetRouting: Restores the system's default routing.
 *    { action: "resetRouting"}
 *
 * Response
 *
 *  { statusCode: <int> }
 *
 */
namespace OutlineService {
  public partial class OutlineService : ServiceBase {
    private const string EVENT_LOG_SOURCE = "OutlineService";
    private const string EVENT_LOG_NAME = "Application";
    private const string PIPE_NAME = "OutlineServicePipe"; // Must be kept in sync with electron.
    private const string TAP_DEVICE_NAME = "outline-tap0";

    private const string ACTION_CONFIGURE_ROUTING = "configureRouting";
    private const string ACTION_RESET_ROUTING = "resetRouting";
    private const string PARAM_ROUTER_IP = "routerIp";
    private const string PARAM_PROXY_IP = "proxyIp";

    private static string[] IPV4_SUBNETS = { "0.0.0.0/1", "128.0.0.0/1" };
    private static string[] IPV6_SUBNETS = { "fc00::/7", "2000::/4", "3000::/4" };
    private const string CMD_NETSH = "netsh";

    private const uint BUFFER_SIZE_BYTES = 1024;
    private const int ERROR_CODE_INTERNAL = -1;

    private EventLog eventLog;
    private NamedPipeServerStream pipe;
    private string proxyIp;
    private int proxyInterfaceIndex = ERROR_CODE_INTERNAL;
    private IPAddress systemGatewayIp;

    public OutlineService() {
      InitializeComponent();
      eventLog = new EventLog();
      if (!EventLog.SourceExists(EVENT_LOG_SOURCE)) {
        EventLog.CreateEventSource(EVENT_LOG_SOURCE, EVENT_LOG_NAME);
      }
      eventLog.Source = EVENT_LOG_SOURCE;
      eventLog.Log = EVENT_LOG_NAME;

      CreatePipe();
    }

    protected override void OnStart(string[] args) {
      eventLog.WriteEntry("OutlineService starting");
      NetworkChange.NetworkAddressChanged +=
          new NetworkAddressChangedEventHandler(NetworkAddressChanged);
      pipe.BeginWaitForConnection(HandleConnection, null);
    }

    protected override void OnStop() {
      eventLog.WriteEntry("OutlineService stopping");
      DestroyPipe();
      NetworkChange.NetworkAddressChanged -= NetworkAddressChanged;
    }

    private void CreatePipe() {
      var pipeSecurity = new PipeSecurity();
      pipeSecurity.AddAccessRule(new PipeAccessRule("Users", PipeAccessRights.ReadWrite, AccessControlType.Allow));
      pipeSecurity.AddAccessRule(new PipeAccessRule("CREATOR OWNER", PipeAccessRights.FullControl, AccessControlType.Allow));
      pipeSecurity.AddAccessRule(new PipeAccessRule("SYSTEM", PipeAccessRights.FullControl, AccessControlType.Allow));
      pipe = new NamedPipeServerStream(PIPE_NAME, PipeDirection.InOut, -1, PipeTransmissionMode.Message,
                                       PipeOptions.Asynchronous, (int)BUFFER_SIZE_BYTES, (int)BUFFER_SIZE_BYTES, pipeSecurity);
    }

    private void DestroyPipe() {
      if (pipe == null) {
        return;
      }
      try {
        if (pipe.IsConnected) {
          pipe.Disconnect();
        }
        pipe.Close();
        pipe = null;
      } catch (Exception e) {
        eventLog.WriteEntry($"Got an exception while destroying the pipe: {e.ToString()}",
                            EventLogEntryType.Warning);
      }
    }

    private void HandleConnection(IAsyncResult result) {
      eventLog.WriteEntry("Got incoming connection");
      try {
        pipe.EndWaitForConnection(result);
        var request = ReadRequest();
        if (request == null) {
          WriteResponse(ERROR_CODE_INTERNAL);
          return;
        }
        var statusCode = HandleRequest(request);
        WriteResponse(statusCode);
      } catch (Exception e) {
        eventLog.WriteEntry($"Failed to handle connection: {e.ToString()}", EventLogEntryType.Error);
      } finally {
        // Pipe streams are one-to-one connections. Recreate the pipe to handle subsequent requests.
        DestroyPipe();
        CreatePipe();
        pipe.BeginWaitForConnection(HandleConnection, null);
      }
    }

    private ServiceRequest ReadRequest() {
      var stringBuilder = new StringBuilder();
      var buffer = new byte[BUFFER_SIZE_BYTES];
      var memoryStream = new MemoryStream();
      do {
        var readBytes = pipe.Read(buffer, 0, buffer.Length);
        memoryStream.Write(buffer, 0, readBytes);
      } while (!pipe.IsMessageComplete);
      var msg = Encoding.UTF8.GetString(buffer);
      if (String.IsNullOrWhiteSpace(msg)) {
        eventLog.WriteEntry("Failed to read request", EventLogEntryType.Error);
        return null;
      }
      eventLog.WriteEntry($"Got message: {msg}");
      return ParseRequest(msg);
    }

    private ServiceRequest ParseRequest(string jsonRequest) {
      try {
        return JsonConvert.DeserializeObject<ServiceRequest>(jsonRequest);
      } catch (Exception e) {
        eventLog.WriteEntry($"Failed to parse request: {e.ToString()}");
      }
      return null;
    }

    private void WriteResponse(int statusCode) {
      var response = new ServiceResponse();
      response.statusCode = statusCode;
      var jsonResponse = SerializeResponse(response);
      if (jsonResponse == null) {
        eventLog.WriteEntry("Failed to serialize response.", EventLogEntryType.Error);
        return;
      }
      var jsonResponseBytes = Encoding.UTF8.GetBytes(jsonResponse);
      pipe.Write(jsonResponseBytes, 0, jsonResponseBytes.Length);
      pipe.Flush();
      pipe.WaitForPipeDrain();
    }

    private string SerializeResponse(ServiceResponse response) {
      try {
        return JsonConvert.SerializeObject(response);
      } catch (Exception e) {
        eventLog.WriteEntry($"Failed to serialize response: {e.ToString()}");
      }
      return null;
    }

    private int HandleRequest(ServiceRequest request) {
      if (request == null) {
        return ERROR_CODE_INTERNAL;
      }
      switch (request.action) {
        case ACTION_CONFIGURE_ROUTING:
          return ConfigureRouting(request.parameters[PARAM_ROUTER_IP], request.parameters[PARAM_PROXY_IP]);
        case ACTION_RESET_ROUTING:
          return ResetRouting();
        default:
          eventLog.WriteEntry($"Received invalid request: {request.action}", EventLogEntryType.Error);
          break;
      }
      return ERROR_CODE_INTERNAL;
    }

    // Routes all device traffic through the router, at IP address `routerIp`. The proxy's IP is configured
    // to bypass the router, and connect through the system's default gateway.
    private int ConfigureRouting(string routerIp, string proxyIp) {
      if (routerIp == null || proxyIp == null) {
        eventLog.WriteEntry("Got null router and/or proxy IP.", EventLogEntryType.Error);
        return ERROR_CODE_INTERNAL;
      }
      systemGatewayIp = GetSystemGatewayIp();
      if (systemGatewayIp == null) {
        eventLog.WriteEntry("Failed to retrieve the system gateway IP", EventLogEntryType.Error);
        return ERROR_CODE_INTERNAL;
      }
      eventLog.WriteEntry($"Got system gateway IP {systemGatewayIp.ToString()}");

      // Proxy routing: the proxy's IP address should be the only one that bypasses the router.
      // Save the best interface index for the proxy's address before we add the route. This
      // is necessary for updating the proxy route when the network changes; otherwise we get the
      // TAP device as the best interface.
      proxyInterfaceIndex = GetBestInterfaceIndex(systemGatewayIp);
      if (proxyInterfaceIndex == ERROR_CODE_INTERNAL) {
        eventLog.WriteEntry("Failed to get interface for the proxy's address", EventLogEntryType.Error);
        return ERROR_CODE_INTERNAL;
      }
      var proxyRoutingResult = AddProxyRoute(proxyIp, systemGatewayIp.ToString(), proxyInterfaceIndex);
      this.proxyIp = proxyIp; // Save the proxy's IP so we can reset routing.

      // Route IPv4 traffic through the router. Instead of deleting the default IPv4 gateway (0.0.0.0/0),
      // we resort to creating two more specific routes (see IPV4_SUBNETS) that take precedence over the
      // default gateway. This way, we need not worry about the default gateway being recreated with a lower
      // metric upon device sleep. This 'hack' was inspired by OpenVPN;
      // see https://github.com/OpenVPN/openvpn3/commit/d08cc059e7132a3d3aee3dcd946fce4c35b1ced3#diff-1d76f0fd7ec04c6d1398288214a879c5R358.
      var argsFormat = "interface ipv4 add route {0} nexthop={1} interface={2} metric=0";
      foreach (string subnet in IPV4_SUBNETS) {
        RunCommand(CMD_NETSH, string.Format(argsFormat, subnet, routerIp, TAP_DEVICE_NAME));
      }

      // Outline does not currently support IPv6, so we resort to disabling it while the VPN is active to
      // prevent leakage. Removing the deafault IPv6 gateway is not enough since it gets re-created
      // through router advertisements and DHCP (disabling these or IPv6 routing altogether requires a
      // system reboot). Thus, we resort to creating three IPv6 routes (see IPV6_SUBNETS) to the loopback
      // interface that are more specific than the default route, causing IPv6 traffic to get dropped.
      argsFormat = "interface ipv6 add route {0} interface={1} metric=0";
      foreach (string subnet in IPV6_SUBNETS) {
        RunCommand(CMD_NETSH, string.Format(argsFormat, subnet, NetworkInterface.IPv6LoopbackInterfaceIndex));
      }

      // TODO: inspect stderr, stdout for known errors (i.e. routes already exists); reset routing on failulre
      return 0;
    }

    // Resets the routing table to route traffic through the default IPv4 and IPv6 gatways.
    private int ResetRouting() {
      if (proxyIp == null) {
        eventLog.WriteEntry("Got null proxy IP.", EventLogEntryType.Error);
        return ERROR_CODE_INTERNAL;
      }
      if (proxyInterfaceIndex == ERROR_CODE_INTERNAL) {
        eventLog.WriteEntry("Proxy interface index not set.", EventLogEntryType.Error);
        return ERROR_CODE_INTERNAL;
      }

      // Proxy routing
      var proxyRoutingResult = DeleteProxyRoute(proxyIp, proxyInterfaceIndex);
      this.proxyIp = null;
      this.proxyInterfaceIndex = ERROR_CODE_INTERNAL;

      // IPv4 routing: delete routes to the router.
      var argsFormat = "interface ipv4 delete route {0} interface={1}";
      foreach (string subnet in IPV4_SUBNETS) {
        var result = RunCommand(CMD_NETSH, string.Format(argsFormat, subnet, TAP_DEVICE_NAME));
      }

      // IPv6 routing: enable IPv6 by removing the routes to the local interface.
      argsFormat = "interface ipv6 delete route {0} interface={1}";
      foreach (string subnet in IPV6_SUBNETS) {
        var result = RunCommand(
            CMD_NETSH, string.Format(argsFormat, subnet, NetworkInterface.IPv6LoopbackInterfaceIndex));
      }

      return 0;
    }

    private CommandResult AddProxyRoute(string proxyIp, string systemGatewayIp, int interfaceIndex) {
      return RunCommand(
          CMD_NETSH, $"interface ipv4 add route {proxyIp}/32 nexthop={systemGatewayIp} " +
          $"interface={interfaceIndex} metric=0");
    }

    private CommandResult DeleteProxyRoute(string proxyIp, int interfaceIndex) {
      return RunCommand(CMD_NETSH, $"interface ipv4 delete route {proxyIp}/32 interface={interfaceIndex}");
    }

    // Runs a shell process, `cmd`, with arguments, `args` synchronously.
    // Returns the process exit code and stanard output/error streams.
    private CommandResult RunCommand(string cmd, string args) {
      var result = new CommandResult();
      try {
        var startInfo = new ProcessStartInfo(cmd);
        startInfo.Arguments = args;
        startInfo.UseShellExecute = false;
        startInfo.RedirectStandardError = true;
        startInfo.RedirectStandardOutput = true;

        Process p = new Process();
        p.OutputDataReceived += (object sender, DataReceivedEventArgs e) => {
          if (e == null || String.IsNullOrWhiteSpace(e.Data)) {
            return;
          }
          result.StdOut.Append(e.Data);
        };
        p.ErrorDataReceived += (object sender, DataReceivedEventArgs e) => {
          if (e == null || String.IsNullOrWhiteSpace(e.Data)) {
            return;
          }
          result.StdErr.Append(e.Data);
        };
        p.StartInfo = startInfo;
        p.Start();
        p.BeginOutputReadLine();
        p.BeginErrorReadLine();
        p.WaitForExit();

        result.ExitCode = p.ExitCode;
      } catch (Exception e) {
        eventLog.WriteEntry($"Failed to run command {e.ToString()}", EventLogEntryType.Error);
        result.ExitCode = ERROR_CODE_INTERNAL;
      }
      eventLog.WriteEntry($"{cmd} {args} exited with {result.ExitCode}: " +
                          $"{result.StdOut.ToString()} {result.StdErr.ToString()}");
      return result;
    }

    private IPAddress GetSystemGatewayIp() {
      return NetworkInterface.GetAllNetworkInterfaces()
         .Where(n => !TAP_DEVICE_NAME.Equals(n.Name))
         .Where(n => n.NetworkInterfaceType != NetworkInterfaceType.Loopback)
         .SelectMany(n => n.GetIPProperties()?.GatewayAddresses)
         .Select(g => g?.Address)
         .Where(a => a != null)
         .Where(a => a.AddressFamily == AddressFamily.InterNetwork) // IPv4
         .FirstOrDefault();
    }

    [DllImport("iphlpapi.dll", CharSet = CharSet.Auto)]
    private static extern int GetBestInterface(UInt32 destAddr, out UInt32 bestIfIndex);

    private int GetBestInterfaceIndex(IPAddress addr) {
      var addrBytes = BitConverter.ToUInt32(addr.GetAddressBytes(), 0);

      uint interfaceIndex;
      int result = GetBestInterface(addrBytes, out interfaceIndex);
      if (result != 0) {
        return ERROR_CODE_INTERNAL;
      }
      return (int)interfaceIndex;
    }

    private void NetworkAddressChanged(object sender, EventArgs e) {
      if (proxyIp == null || systemGatewayIp == null ||
          proxyInterfaceIndex == ERROR_CODE_INTERNAL) {
        return;  // Outline is not connected.
      }
      var newSystemGatewayIp = GetSystemGatewayIp();
      if (newSystemGatewayIp == null) {
        eventLog.WriteEntry("Failed to retrieve the system gateway IP", EventLogEntryType.Error);
        return;
      }
      eventLog.WriteEntry($"Network change. System gateway IP: {newSystemGatewayIp.ToString()}, " +
                          $"Previous IP: {systemGatewayIp.ToString()}");
      if (newSystemGatewayIp.Equals(systemGatewayIp)) {
        return;  // No need to update the proxy route.
      }

      // Get the best interface for the new system gateway, in case the interface itself has changed
      // (i.e. Ethernet -> WiFi).
      var newInterfaceIndex = GetBestInterfaceIndex(newSystemGatewayIp);
      if (newInterfaceIndex == ERROR_CODE_INTERNAL) {
        eventLog.WriteEntry($"Failed to get best interface for address {newSystemGatewayIp.ToString()}",
                            EventLogEntryType.Error);
        return;
      }
      DeleteProxyRoute(proxyIp, proxyInterfaceIndex);
      AddProxyRoute(proxyIp, newSystemGatewayIp.ToString(), newInterfaceIndex);
      proxyInterfaceIndex = newInterfaceIndex;
      systemGatewayIp = newSystemGatewayIp;
    }

    // Debug function to print the network interfaces.
    private void PrintNetworkInfo() {
      var adapters = NetworkInterface.GetAllNetworkInterfaces();
      var sb = new StringBuilder();
      foreach (var adapter in adapters) {
        sb.Append($"{adapter.Name} ({adapter.OperationalStatus}): {adapter.Description} ({adapter.Id})\n");
        if (adapter.Supports(NetworkInterfaceComponent.IPv4)) {
          sb.Append("IPv4 ");
        } else if (adapter.Supports(NetworkInterfaceComponent.IPv6)) {
          sb.Append("IPv6 ");
        }
        sb.Append($"{adapter.NetworkInterfaceType}\n");
        var props = adapter.GetIPProperties();
        foreach (var addr in props.GatewayAddresses) {
          sb.Append($"{addr.Address.ToString()}\t");
        }
        sb.Append("\n");
      }
      eventLog.WriteEntry(sb.ToString());
    }
  }

  [DataContract]
  internal class ServiceRequest {
    [DataMember]
    internal string action;
    [DataMember]
    internal Dictionary<string, string> parameters;
  }

  [DataContract]
  internal class ServiceResponse {
    [DataMember]
    internal int statusCode;
  }

  internal class CommandResult {
    internal int ExitCode;
    internal StringBuilder StdErr;
    internal StringBuilder StdOut;

    internal CommandResult() {
      StdErr = new StringBuilder();
      StdOut = new StringBuilder();
    }
  }
}
