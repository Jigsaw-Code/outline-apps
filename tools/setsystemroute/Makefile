CC=gcc

CCFLAGS = -Wall

LDFLAGS += -lwininet -liphlpapi -lws2_32

all: setsystemproxy.exe
setsystemproxy.exe:
	$(CC) $(CCFLAGS) setsystemproxy.c -o setsystemproxy.exe $(LDFLAGS)
