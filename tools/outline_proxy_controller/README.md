# Outline Proxy Controller Daemon for GNU/Linux

## Building 

You need Boost C++ Libraries version 1.67 or newer to be able to make the proxy controller. you can download the source and build it as follows:

    wget https://dl.bintray.com/boostorg/release/1.67.0/source/boost_1_67_0.tar.bz2
    tar xf boost_1_67_0.tar.bz2
    cd boost_1_67_0
    ./bootstrap.sh
    ./b2 toolset=gcc -j`nproc`

To bulid controller daeman clone the outline client repo

    cd outline-client/tools/outline_proxy_controller/
    mkdir build
    cd build
    cmake .. -DBOOST_ROOT=/path/to/boost_1_67_0
    make 
    
To run 

    sudo ./OutlineProxyController /var/run/outline_controller [-d]
        
Using -d runs the controller in the daemon mode.

Then you can communincate with the controller through the local unix socket /var/run/outline_controller

You then need to run ss-local and badvpn with parameter from the outline server.
    
    ss-local -s $OUTLINE_SERVER_IP -p outline_port -b 0.0.0.0 -l 1080 -k $OUTLINE_PASSWORD -m chacha20-ietf-poly1305 -u

    badvpn-tun2socks --tundev tun0 --netif-ipaddr 10.0.85.2 --netif-netmask 255.255.255.0 --socks-server-addr localhost:1080
    
(These commands run by Outline client electoron app if you are using the app).

After that if you write the following json command into the unix socket
    
    {"action":"configureRouting","parameters":{"proxyIp":"outline_server_ip_address","routerIp":"10.0.85.1"}}
    
Your traffic is sent over Outline. To resume normal routing (not through outline proxy), write 

    {"action":"resetRouting","parameters":{}}
    
Into the socket.

