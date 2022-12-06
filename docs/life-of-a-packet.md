# Life of a Packet

```mermaid
flowchart LR
  A(Apps) <--> S(Socket)
  subgraph Operating System
    S <--> R(Routing Table)
  end
  R <-- Outline OFF --> IF(Network Interface)
  IF <--> INET(((Internet)))
  R <-- Outline ON --> TUN(Tun Device)
  TUN <--> T2S(Tun2socket)
  subgraph Outline Client
    T2S <--> SC(Shadowsocks Client)
  end
  SC <--> IF
```
