# Outline Proxy Controller Daemon for GNU/Linux

## Building 

You need Boost C++ Libraries version 1.67 or newer to be able to make the proxy controller. you can download the source and build it as follows:

    wget https://dl.bintray.com/boostorg/release/1.67.0/source/boost_1_67_0.tar.bz2
    tar xf boost_1_67_0.tar.bz2
    cd boost_1_67_0
    ./bootstrap.sh
    ./b2 toolset=gcc -j`nproc`

To build controller daemon clone the outline client repo

    cd outline-client/tools/outline_proxy_controller/
    mkdir build
    cd build
    cmake .. -DBOOST_ROOT=/path/to/boost_1_67_0
    make 
    
To run 

    sudo ./OutlineProxyController /var/run/outline_controller [-d]
        
Using -d runs the controller in the daemon mode.

Then you can communicate with the controller through the local unix socket /var/run/outline_controller

You then need to run ss-local and badvpn with parameter from the outline server.
    
    ss-local -s $OUTLINE_SERVER_IP -p outline_port -b 0.0.0.0 -l 1080 -k $OUTLINE_PASSWORD -m chacha20-ietf-poly1305 -u

    badvpn-tun2socks --tundev tun0 --netif-ipaddr 10.0.85.2 --netif-netmask 255.255.255.0 --socks-server-addr localhost:1080
    
(These commands run by Outline client electoron app if you are using the app).

After that if you write the following json command into the unix socket
    
    {"action":"configureRouting","parameters":{"proxyIp":"outline_server_ip_address","routerIp":"10.0.85.1"}}
    
Your traffic is sent over Outline. To resume normal routing (not through outline proxy), write 

    {"action":"resetRouting","parameters":{}}
    
Into the socket.

## Hacking

The boost libraries has been used mainly for argument processing, and async communication on unix socket.

### Class structure

* outline_daemon.cpp

Contains the main function which makes instances of ControllerConfig and OutlineControllerServer and then run the boost async reactor.

  * OutlineControllerServer: Processes the command line arguments and store the configuration to be used by other classes.

* outline_controller_server.cpp
  contains the networking logic for receiving commands from the outline electron app through the unix socket.

 * OutlineControllerServer:
  starts a simple listener server which accepts connection and make a session object for each of them.
   
 * session
  takes care of reading and writing from a single connection on the unix socket. Furthermore, it checks the validity of the commands written in the socket as json snippets. Finally its interprets the command and calls the appropriate public method from OutlineProxyController class. Currently three commands are supported:
    - CONFIGURE_ROUTING: Routing through Outline proxy
    - RESET_ROUTING: Routing through the initial gateway which was in used instead of sending the traffic through outline.
    - GET_DEVICE_NAME: writing the name of tune device used by outline proxy controller
 
* outline_proxy_controller.cpp
  Contains the implementation of OutlineProxyController class.
  
 * OutlineProxyController
  
  This is the main class in code and perform all of the actions which are necessary to setup the necessary routes to make the traffic
  route smoothly through the outline proxy or the default gateway. Most functions are performed running ip command as a subprocess.
  
  - OutlineProxyController: It is the constructor. It asks the kernel to add the tune device which is going to be used to by tun2socks and then assign a static network setting to it. It also tries to detect the default gateway of the machine in case access to internet is established.
  
  - routeThroughOutline: It first backs up the current DNS Settings, it makes sure it knows about the default gateway. it adds an exceptional route for the traffic destined to the outline proxy server to pass through the machine's default gateway. It then deletes the default route to the default gateway. Then it makes a new rule for all system traffic to route go through the gateway set up by tun2socks. It then turns off the IPv6 protocol on all interfaces of the system. Finally it rewrite the DNS configuration to use google dns server and use TCP traffic to send DNS queries. At each point that the functions fails it reverses all changes it has made.

  - routeDirectly: It basically reverse everything which routeThroughOutline does: Delete all defaults route on the system. Adds a default route for previously default gateway of the system. It then delete the exceptional route for the outline proxy server traffic. It enables IPv6 on all system interfaces and restore the DNS setting its backed-up values provided that such back exists.
  
  ~OutlineProxyController: the destructor, calls routeDirectly in case routing has been set to be through the tun device and then delete the tun device.
