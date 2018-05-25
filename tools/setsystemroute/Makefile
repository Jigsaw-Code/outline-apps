CC=gcc

CCFLAGS = -Wall

LDFLAGS += -lwininet -liphlpapi -lws2_32

all: setsystemroute.exe
setsystemroute.exe:
	$(CC) $(CCFLAGS) setsystemroute.c -o setsystemroute.exe $(LDFLAGS)
