# Outline Proxy Controller Daemon for GNU/Linux

To bulid

    mkdir build
    cd build
    cmake ..
    make
    
To run 

    sudo ./OutlineProxyController /var/run/outline_controller
        
then you can communincate with the controller through the socket.

You then need to run ss-local and badvpn with parameter from the outline server.

    ss-local -s outline_ip -p outline_port -b 0.0.0.0 -l 1080 -k outline_password -m chacha20-ietf-poly1305 -u

    badvpn-tun2socks --tundev tun0 --netif-ipaddr 10.0.85.2 --netif-netmask 255.255.255.0 --socks-server-addr localhost:1080
    
After that

If you write 
    
    connect outline_server_ip_address
    
Your traffic is sent over Outline. To disconnect, write 

    disconnect 
    
Into the socket.

To run in daemon mode use -d option

    sudo ./OutlineProxyController /var/run/outline_controller -d

