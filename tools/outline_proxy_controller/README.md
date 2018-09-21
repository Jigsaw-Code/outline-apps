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

After that

If you write 
    
    connect outline_server_ip_address
    
Your traffic is sent over Outline. To disconnect, write 

    disconnect 
    
Into the socket.

To run in daemon mode use -d option

    sudo ./OutlineProxyController /var/run/outline_controller -d

