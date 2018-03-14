// -*- mode: c++ -*-
#ifndef DNS_PROTO_H
#define DNS_PROTO_H
// Utilities for processing DNS packet contents

// Include ares internal file for DNS protocol constants
#include "nameser.h"

#include <memory>
#include <string>
#include <vector>

namespace ares {

typedef unsigned char byte;

std::string HexDump(std::vector<byte> data);
std::string HexDump(const byte *data, int len);
std::string HexDump(const char *data, int len);

std::string StatusToString(int status);
std::string RcodeToString(int rcode);
std::string RRTypeToString(int rrtype);
std::string ClassToString(int qclass);
std::string AddressToString(const void* addr, int len);

// Convert DNS protocol data to strings.
// Note that these functions are not defensive; they assume
// a validly formatted input, and so should not be used on
// externally-determined inputs.
std::string PacketToString(const std::vector<byte>& packet);
std::string QuestionToString(const std::vector<byte>& packet,
                             const byte** data, int* len);
std::string RRToString(const std::vector<byte>& packet,
                       const byte** data, int* len);


// Manipulate DNS protocol data.
void PushInt32(std::vector<byte>* data, int value);
void PushInt16(std::vector<byte>* data, int value);
std::vector<byte> EncodeString(const std::string& name);

struct DNSQuestion {
  DNSQuestion(const std::string& name, ns_type rrtype, ns_class qclass)
    : name_(name), rrtype_(rrtype), qclass_(qclass) {}
  DNSQuestion(const std::string& name, ns_type rrtype)
    : name_(name), rrtype_(rrtype), qclass_(ns_c_in) {}
  virtual ~DNSQuestion() {}
  virtual std::vector<byte> data() const;
  std::string name_;
  ns_type rrtype_;
  ns_class qclass_;
};

struct DNSRR : public DNSQuestion {
  DNSRR(const std::string& name, ns_type rrtype, ns_class qclass, int ttl)
    : DNSQuestion(name, rrtype, qclass), ttl_(ttl) {}
  DNSRR(const std::string& name, ns_type rrtype, int ttl)
    : DNSQuestion(name, rrtype), ttl_(ttl) {}
  virtual ~DNSRR() {}
  virtual std::vector<byte> data() const = 0;
  int ttl_;
};

struct DNSAddressRR : public DNSRR {
  DNSAddressRR(const std::string& name, ns_type rrtype, int ttl,
               const byte* addr, int addrlen)
    : DNSRR(name, rrtype, ttl), addr_(addr, addr + addrlen) {}
  DNSAddressRR(const std::string& name, ns_type rrtype, int ttl,
               const std::vector<byte>& addr)
    : DNSRR(name, rrtype, ttl), addr_(addr) {}
  virtual std::vector<byte> data() const;
  std::vector<byte> addr_;
};

struct DNSARR : public DNSAddressRR {
  DNSARR(const std::string& name, int ttl, const byte* addr, int addrlen)
    : DNSAddressRR(name, ns_t_a, ttl, addr, addrlen) {}
  DNSARR(const std::string& name, int ttl, const std::vector<byte>& addr)
    : DNSAddressRR(name, ns_t_a, ttl, addr) {}
};

struct DNSAaaaRR : public DNSAddressRR {
  DNSAaaaRR(const std::string& name, int ttl, const byte* addr, int addrlen)
    : DNSAddressRR(name, ns_t_aaaa, ttl, addr, addrlen) {}
  DNSAaaaRR(const std::string& name, int ttl, const std::vector<byte>& addr)
    : DNSAddressRR(name, ns_t_aaaa, ttl, addr) {}
};

struct DNSSingleNameRR : public DNSRR {
  DNSSingleNameRR(const std::string& name, ns_type rrtype, int ttl,
                  const std::string& other)
    : DNSRR(name, rrtype, ttl), other_(other) {}
  virtual std::vector<byte> data() const;
  std::string other_;
};

struct DNSCnameRR : public DNSSingleNameRR {
  DNSCnameRR(const std::string& name, int ttl, const std::string& other)
    : DNSSingleNameRR(name, ns_t_cname, ttl, other) {}
};

struct DNSNsRR : public DNSSingleNameRR {
  DNSNsRR(const std::string& name, int ttl, const std::string& other)
    : DNSSingleNameRR(name, ns_t_ns, ttl, other) {}
};

struct DNSPtrRR : public DNSSingleNameRR {
  DNSPtrRR(const std::string& name, int ttl, const std::string& other)
    : DNSSingleNameRR(name, ns_t_ptr, ttl, other) {}
};

struct DNSTxtRR : public DNSRR {
  DNSTxtRR(const std::string& name, int ttl, const std::vector<std::string>& txt)
    : DNSRR(name, ns_t_txt, ttl), txt_(txt) {}
  virtual std::vector<byte> data() const;
  std::vector<std::string> txt_;
};

struct DNSMxRR : public DNSRR {
  DNSMxRR(const std::string& name, int ttl, int pref, const std::string& other)
    : DNSRR(name, ns_t_mx, ttl), pref_(pref), other_(other) {}
  virtual std::vector<byte> data() const;
  int pref_;
  std::string other_;
};

struct DNSSrvRR : public DNSRR {
  DNSSrvRR(const std::string& name, int ttl,
           int prio, int weight, int port, const std::string& target)
    : DNSRR(name, ns_t_srv, ttl), prio_(prio), weight_(weight), port_(port), target_(target) {}
  virtual std::vector<byte> data() const;
  int prio_;
  int weight_;
  int port_;
  std::string target_;
};

struct DNSSoaRR : public DNSRR {
  DNSSoaRR(const std::string& name, int ttl,
           const std::string& nsname, const std::string& rname,
           int serial, int refresh, int retry, int expire, int minimum)
    : DNSRR(name, ns_t_soa, ttl), nsname_(nsname), rname_(rname),
      serial_(serial), refresh_(refresh), retry_(retry),
      expire_(expire), minimum_(minimum) {}
  virtual std::vector<byte> data() const;
  std::string nsname_;
  std::string rname_;
  int serial_;
  int refresh_;
  int retry_;
  int expire_;
  int minimum_;
};

struct DNSNaptrRR : public DNSRR {
  DNSNaptrRR(const std::string& name, int ttl,
             int order, int pref,
             const std::string& flags,
             const std::string& service,
             const std::string& regexp,
             const std::string& replacement)
    : DNSRR(name, ns_t_naptr, ttl), order_(order), pref_(pref),
      flags_(flags), service_(service), regexp_(regexp), replacement_(replacement) {}
  virtual std::vector<byte> data() const;
  int order_;
  int pref_;
  std::string flags_;
  std::string service_;
  std::string regexp_;
  std::string replacement_;
};

struct DNSOption {
  int code_;
  std::vector<byte> data_;
};

struct DNSOptRR : public DNSRR {
  DNSOptRR(int extrcode, int udpsize)
    : DNSRR("", ns_t_opt, static_cast<ns_class>(udpsize), extrcode) {}
  virtual std::vector<byte> data() const;
  std::vector<DNSOption> opts_;
};

struct DNSPacket {
  DNSPacket()
    : qid_(0), response_(false), opcode_(ns_o_query),
      aa_(false), tc_(false), rd_(false), ra_(false),
      z_(false), ad_(false), cd_(false), rcode_(ns_r_noerror) {}
  // Convenience functions that take ownership of given pointers.
  DNSPacket& add_question(DNSQuestion *q) {
    questions_.push_back(std::unique_ptr<DNSQuestion>(q));
    return *this;
  }
  DNSPacket& add_answer(DNSRR *q) {
    answers_.push_back(std::unique_ptr<DNSRR>(q));
    return *this;
  }
  DNSPacket& add_auth(DNSRR *q) {
    auths_.push_back(std::unique_ptr<DNSRR>(q));
    return *this;
  }
  DNSPacket& add_additional(DNSRR *q) {
    adds_.push_back(std::unique_ptr<DNSRR>(q));
    return *this;
  }
  // Chainable setters.
  DNSPacket& set_qid(int qid) { qid_ = qid; return *this; }
  DNSPacket& set_response(bool v = true) { response_ = v; return *this; }
  DNSPacket& set_aa(bool v = true) { aa_ = v; return *this; }
  DNSPacket& set_tc(bool v = true) { tc_ = v; return *this; }
  DNSPacket& set_rd(bool v = true) { rd_ = v; return *this; }
  DNSPacket& set_ra(bool v = true) { ra_ = v; return *this; }
  DNSPacket& set_z(bool v = true) { z_ = v; return *this; }
  DNSPacket& set_ad(bool v = true) { ad_ = v; return *this; }
  DNSPacket& set_cd(bool v = true) { cd_ = v; return *this; }
  DNSPacket& set_rcode(ns_rcode rcode) { rcode_ = rcode; return *this; }

  // Return the encoded packet.
  std::vector<byte> data() const;

  int qid_;
  bool response_;
  ns_opcode opcode_;
  bool aa_;
  bool tc_;
  bool rd_;
  bool ra_;
  bool z_;
  bool ad_;
  bool cd_;
  ns_rcode rcode_;
  std::vector<std::unique_ptr<DNSQuestion>> questions_;
  std::vector<std::unique_ptr<DNSRR>> answers_;
  std::vector<std::unique_ptr<DNSRR>> auths_;
  std::vector<std::unique_ptr<DNSRR>> adds_;
};

}  // namespace ares

#endif
