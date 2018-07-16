#include "dns-proto.h"

// Include ares internal file for DNS protocol details
#include "ares_setup.h"
#include "ares.h"
#include "ares_dns.h"

#include <stdio.h>
#include <stdlib.h>

#include <sstream>

namespace ares {

std::string HexDump(std::vector<byte> data) {
  std::stringstream ss;
  for (size_t ii = 0; ii < data.size();  ii++) {
    char buffer[2 + 1];
    sprintf(buffer, "%02x", data[ii]);
    ss << buffer;
  }
  return ss.str();
}

std::string HexDump(const byte *data, int len) {
  return HexDump(std::vector<byte>(data, data + len));
}

std::string HexDump(const char *data, int len) {
  return HexDump(reinterpret_cast<const byte*>(data), len);
}

std::string StatusToString(int status) {
  switch (status) {
  case ARES_SUCCESS: return "ARES_SUCCESS";
  case ARES_ENODATA: return "ARES_ENODATA";
  case ARES_EFORMERR: return "ARES_EFORMERR";
  case ARES_ESERVFAIL: return "ARES_ESERVFAIL";
  case ARES_ENOTFOUND: return "ARES_ENOTFOUND";
  case ARES_ENOTIMP: return "ARES_ENOTIMP";
  case ARES_EREFUSED: return "ARES_EREFUSED";
  case ARES_EBADQUERY: return "ARES_EBADQUERY";
  case ARES_EBADNAME: return "ARES_EBADNAME";
  case ARES_EBADFAMILY: return "ARES_EBADFAMILY";
  case ARES_EBADRESP: return "ARES_EBADRESP";
  case ARES_ECONNREFUSED: return "ARES_ECONNREFUSED";
  case ARES_ETIMEOUT: return "ARES_ETIMEOUT";
  case ARES_EOF: return "ARES_EOF";
  case ARES_EFILE: return "ARES_EFILE";
  case ARES_ENOMEM: return "ARES_ENOMEM";
  case ARES_EDESTRUCTION: return "ARES_EDESTRUCTION";
  case ARES_EBADSTR: return "ARES_EBADSTR";
  case ARES_EBADFLAGS: return "ARES_EBADFLAGS";
  case ARES_ENONAME: return "ARES_ENONAME";
  case ARES_EBADHINTS: return "ARES_EBADHINTS";
  case ARES_ENOTINITIALIZED: return "ARES_ENOTINITIALIZED";
  case ARES_ELOADIPHLPAPI: return "ARES_ELOADIPHLPAPI";
  case ARES_EADDRGETNETWORKPARAMS: return "ARES_EADDRGETNETWORKPARAMS";
  case ARES_ECANCELLED: return "ARES_ECANCELLED";
  default: return "UNKNOWN";
  }
}

std::string RcodeToString(int rcode) {
  switch (rcode) {
  case ns_r_noerror: return "NOERROR";
  case ns_r_formerr: return "FORMERR";
  case ns_r_servfail: return "SERVFAIL";
  case ns_r_nxdomain: return "NXDOMAIN";
  case ns_r_notimpl: return "NOTIMPL";
  case ns_r_refused: return "REFUSED";
  case ns_r_yxdomain: return "YXDOMAIN";
  case ns_r_yxrrset: return "YXRRSET";
  case ns_r_nxrrset: return "NXRRSET";
  case ns_r_notauth: return "NOTAUTH";
  case ns_r_notzone: return "NOTZONE";
  case ns_r_badsig: return "BADSIG";
  case ns_r_badkey: return "BADKEY";
  case ns_r_badtime: return "BADTIME";
  default: return "UNKNOWN";
  }
}

std::string RRTypeToString(int rrtype) {
  switch (rrtype) {
  case ns_t_a: return "A";
  case ns_t_ns: return "NS";
  case ns_t_md: return "MD";
  case ns_t_mf: return "MF";
  case ns_t_cname: return "CNAME";
  case ns_t_soa: return "SOA";
  case ns_t_mb: return "MB";
  case ns_t_mg: return "MG";
  case ns_t_mr: return "MR";
  case ns_t_null: return "NULL";
  case ns_t_wks: return "WKS";
  case ns_t_ptr: return "PTR";
  case ns_t_hinfo: return "HINFO";
  case ns_t_minfo: return "MINFO";
  case ns_t_mx: return "MX";
  case ns_t_txt: return "TXT";
  case ns_t_rp: return "RP";
  case ns_t_afsdb: return "AFSDB";
  case ns_t_x25: return "X25";
  case ns_t_isdn: return "ISDN";
  case ns_t_rt: return "RT";
  case ns_t_nsap: return "NSAP";
  case ns_t_nsap_ptr: return "NSAP_PTR";
  case ns_t_sig: return "SIG";
  case ns_t_key: return "KEY";
  case ns_t_px: return "PX";
  case ns_t_gpos: return "GPOS";
  case ns_t_aaaa: return "AAAA";
  case ns_t_loc: return "LOC";
  case ns_t_nxt: return "NXT";
  case ns_t_eid: return "EID";
  case ns_t_nimloc: return "NIMLOC";
  case ns_t_srv: return "SRV";
  case ns_t_atma: return "ATMA";
  case ns_t_naptr: return "NAPTR";
  case ns_t_kx: return "KX";
  case ns_t_cert: return "CERT";
  case ns_t_a6: return "A6";
  case ns_t_dname: return "DNAME";
  case ns_t_sink: return "SINK";
  case ns_t_opt: return "OPT";
  case ns_t_apl: return "APL";
  case ns_t_ds: return "DS";
  case ns_t_sshfp: return "SSHFP";
  case ns_t_rrsig: return "RRSIG";
  case ns_t_nsec: return "NSEC";
  case ns_t_dnskey: return "DNSKEY";
  case ns_t_tkey: return "TKEY";
  case ns_t_tsig: return "TSIG";
  case ns_t_ixfr: return "IXFR";
  case ns_t_axfr: return "AXFR";
  case ns_t_mailb: return "MAILB";
  case ns_t_maila: return "MAILA";
  case ns_t_any: return "ANY";
  case ns_t_zxfr: return "ZXFR";
  case ns_t_max: return "MAX";
  default: return "UNKNOWN";
  }
}

std::string ClassToString(int qclass) {
  switch (qclass) {
  case ns_c_in: return "IN";
  case ns_c_chaos: return "CHAOS";
  case ns_c_hs: return "HESIOD";
  case ns_c_none: return "NONE";
  case ns_c_any: return "ANY";
  default: return "UNKNOWN";
  }
}

std::string AddressToString(const void* vaddr, int len) {
  const byte* addr = reinterpret_cast<const byte*>(vaddr);
  std::stringstream ss;
  if (len == 4) {
    char buffer[4*4 + 3 + 1];
    sprintf(buffer, "%u.%u.%u.%u",
            (unsigned char)addr[0],
            (unsigned char)addr[1],
            (unsigned char)addr[2],
            (unsigned char)addr[3]);
    ss << buffer;
  } else if (len == 16) {
    for (int ii = 0; ii < 16;  ii+=2) {
      if (ii > 0) ss << ':';
      char buffer[4 + 1];
      sprintf(buffer, "%02x%02x", (unsigned char)addr[ii], (unsigned char)addr[ii+1]);
      ss << buffer;
    }
  } else {
    ss << "!" << HexDump(addr, len) << "!";
  }
  return ss.str();
}

std::string PacketToString(const std::vector<byte>& packet) {
  const byte* data = packet.data();
  int len = packet.size();
  std::stringstream ss;
  if (len < NS_HFIXEDSZ) {
    ss << "(too short, len " << len << ")";
    return ss.str();
  }
  ss << ((DNS_HEADER_QR(data) == 0) ? "REQ " : "RSP ");
  switch (DNS_HEADER_OPCODE(data)) {
  case ns_o_query: ss << "QRY "; break;
  case ns_o_iquery: ss << "IQRY "; break;
  case ns_o_status: ss << "STATUS "; break;
  case ns_o_notify: ss << "NOTIFY "; break;
  case ns_o_update: ss << "UPDATE "; break;
  default: ss << "UNKNOWN(" << DNS_HEADER_OPCODE(data) << ") "; break;
  }
  if (DNS_HEADER_AA(data)) ss << "AA ";
  if (DNS_HEADER_TC(data)) ss << "TC ";
  if (DNS_HEADER_RD(data)) ss << "RD ";
  if (DNS_HEADER_RA(data)) ss << "RA ";
  if (DNS_HEADER_Z(data)) ss << "Z ";
  if (DNS_HEADER_QR(data) == 1) ss << RcodeToString(DNS_HEADER_RCODE(data));

  int nquestions = DNS_HEADER_QDCOUNT(data);
  int nanswers = DNS_HEADER_ANCOUNT(data);
  int nauths = DNS_HEADER_NSCOUNT(data);
  int nadds = DNS_HEADER_ARCOUNT(data);

  const byte* pq = data + NS_HFIXEDSZ;
  len -= NS_HFIXEDSZ;
  for (int ii = 0; ii < nquestions; ii++) {
    ss << " Q:" << QuestionToString(packet, &pq, &len);
  }
  const byte* prr = pq;
  for (int ii = 0; ii < nanswers; ii++) {
    ss << " A:" << RRToString(packet, &prr, &len);
  }
  for (int ii = 0; ii < nauths; ii++) {
    ss << " AUTH:" << RRToString(packet, &prr, &len);
  }
  for (int ii = 0; ii < nadds; ii++) {
    ss << " ADD:" << RRToString(packet, &prr, &len);
  }
  return ss.str();
}

std::string QuestionToString(const std::vector<byte>& packet,
                             const byte** data, int* len) {
  std::stringstream ss;
  ss << "{";
  if (*len < NS_QFIXEDSZ) {
    ss << "(too short, len " << *len << ")";
    return ss.str();
  }

  char *name = nullptr;
  long enclen;
  int rc = ares_expand_name(*data, packet.data(), packet.size(), &name, &enclen);
  if (rc != ARES_SUCCESS) {
    ss << "(error from ares_expand_name)";
    return ss.str();
  }
  if (enclen > *len) {
    ss << "(error, encoded name len " << enclen << "bigger than remaining data " << *len << " bytes)";
    return ss.str();
  }
  *len -= enclen;
  *data += enclen;
  ss << "'" << name << "' ";
  ares_free_string(name);
  if (*len < NS_QFIXEDSZ) {
    ss << "(too short, len left " << *len << ")";
    return ss.str();
  }
  ss << ClassToString(DNS_QUESTION_CLASS(*data)) << " ";
  ss << RRTypeToString(DNS_QUESTION_TYPE(*data));
  *data += NS_QFIXEDSZ;
  *len -= NS_QFIXEDSZ;
  ss << "}";
  return ss.str();
}

std::string RRToString(const std::vector<byte>& packet,
                       const byte** data, int* len) {
  std::stringstream ss;
  ss << "{";
  if (*len < NS_RRFIXEDSZ) {
    ss << "too short, len " << *len << ")";
    return ss.str();
  }

  char *name = nullptr;
  long enclen;
  int rc = ares_expand_name(*data, packet.data(), packet.size(), &name, &enclen);
  if (rc != ARES_SUCCESS) {
    ss << "(error from ares_expand_name)";
    return ss.str();
  }
  if (enclen > *len) {
    ss << "(error, encoded name len " << enclen << "bigger than remaining data " << *len << " bytes)";
    return ss.str();
  }
  *len -= enclen;
  *data += enclen;
  ss << "'" << name << "' ";
  ares_free_string(name);
  name = nullptr;

  if (*len < NS_RRFIXEDSZ) {
    ss << "(too short, len left " << *len << ")";
    return ss.str();
  }
  int rrtype = DNS_RR_TYPE(*data);
  if (rrtype == ns_t_opt) {
    ss << "MAXUDP=" << DNS_RR_CLASS(*data) << " ";
    ss << RRTypeToString(rrtype) << " ";
    ss << "RCODE2=" << DNS_RR_TTL(*data);
  } else {
    ss << ClassToString(DNS_RR_CLASS(*data)) << " ";
    ss << RRTypeToString(rrtype) << " ";
    ss << "TTL=" << DNS_RR_TTL(*data);
  }
  int rdatalen = DNS_RR_LEN(*data);

  *data += NS_RRFIXEDSZ;
  *len -= NS_RRFIXEDSZ;
  if (*len < rdatalen) {
    ss << "(RR too long at " << rdatalen << ", len left " << *len << ")";
  } else {
    switch (rrtype) {
    case ns_t_a:
    case ns_t_aaaa:
      ss << " " << AddressToString(*data, rdatalen);
      break;
    case ns_t_txt: {
      const byte* p = *data;
      while (p < (*data + rdatalen)) {
        int len = *p++;
        if ((p + len) <= (*data + rdatalen)) {
          std::string txt(p, p + len);
          ss << " " << len << ":'" << txt << "'";
        } else {
          ss << "(string too long)";
        }
        p += len;
      }
      break;
    }
    case ns_t_cname:
    case ns_t_ns:
    case ns_t_ptr: {
      int rc = ares_expand_name(*data, packet.data(), packet.size(), &name, &enclen);
      if (rc != ARES_SUCCESS) {
        ss << "(error from ares_expand_name)";
        break;
      }
      ss << " '" << name << "'";
      ares_free_string(name);
      break;
    }
    case ns_t_mx:
      if (rdatalen > 2) {
        int rc = ares_expand_name(*data + 2, packet.data(), packet.size(), &name, &enclen);
        if (rc != ARES_SUCCESS) {
          ss << "(error from ares_expand_name)";
          break;
        }
        ss << " " << DNS__16BIT(*data) << " '" << name << "'";
        ares_free_string(name);
      } else {
        ss << "(RR too short)";
      }
      break;
    case ns_t_srv: {
      if (rdatalen > 6) {
        const byte* p = *data;
        unsigned long prio = DNS__16BIT(p);
        unsigned long weight = DNS__16BIT(p + 2);
        unsigned long port = DNS__16BIT(p + 4);
        p += 6;
        int rc = ares_expand_name(p, packet.data(), packet.size(), &name, &enclen);
        if (rc != ARES_SUCCESS) {
          ss << "(error from ares_expand_name)";
          break;
        }
        ss << prio << " " << weight << " " << port << " '" << name << "'";
        ares_free_string(name);
      } else {
        ss << "(RR too short)";
      }
      break;
    }
    case ns_t_soa: {
      const byte* p = *data;
      int rc = ares_expand_name(p, packet.data(), packet.size(), &name, &enclen);
      if (rc != ARES_SUCCESS) {
        ss << "(error from ares_expand_name)";
        break;
      }
      ss << " '" << name << "'";
      ares_free_string(name);
      p += enclen;
      rc = ares_expand_name(p, packet.data(), packet.size(), &name, &enclen);
      if (rc != ARES_SUCCESS) {
        ss << "(error from ares_expand_name)";
        break;
      }
      ss << " '" << name << "'";
      ares_free_string(name);
      p += enclen;
      if ((p + 20) <= (*data + rdatalen)) {
        unsigned long serial = DNS__32BIT(p);
        unsigned long refresh = DNS__32BIT(p + 4);
        unsigned long retry = DNS__32BIT(p + 8);
        unsigned long expire = DNS__32BIT(p + 12);
        unsigned long minimum = DNS__32BIT(p + 16);
        ss << " " << serial << " " << refresh << " " << retry << " " << expire << " " << minimum;
      } else {
        ss << "(RR too short)";
      }
      break;
    }
    case ns_t_naptr: {
      if (rdatalen > 7) {
        const byte* p = *data;
        unsigned long order = DNS__16BIT(p);
        unsigned long pref = DNS__16BIT(p + 2);
        p += 4;
        ss << order << " " << pref;

        int len = *p++;
        std::string flags(p, p + len);
        ss << " " << flags;
        p += len;

        len = *p++;
        std::string service(p, p + len);
        ss << " '" << service << "'";
        p += len;

        len = *p++;
        std::string regexp(p, p + len);
        ss << " '" << regexp << "'";
        p += len;

        int rc = ares_expand_name(p, packet.data(), packet.size(), &name, &enclen);
        if (rc != ARES_SUCCESS) {
          ss << "(error from ares_expand_name)";
          break;
        }
        ss << " '" << name << "'";
        ares_free_string(name);
      } else {
        ss << "(RR too short)";
      }
      break;
    }
    default:
      ss << " " << HexDump(*data, rdatalen);
      break;
    }
  }
  *data += rdatalen;
  *len -= rdatalen;

  ss << "}";
  return ss.str();
}

void PushInt32(std::vector<byte>* data, int value) {
  data->push_back((value & 0xff000000) >> 24);
  data->push_back((value & 0x00ff0000) >> 16);
  data->push_back((value & 0x0000ff00) >> 8);
  data->push_back(value & 0x000000ff);
}

void PushInt16(std::vector<byte>* data, int value) {
  data->push_back((value & 0xff00) >> 8);
  data->push_back(value & 0x00ff);
}

std::vector<byte> EncodeString(const std::string& name) {
  std::vector<byte> data;
  std::stringstream ss(name);
  std::string label;
  // TODO: cope with escapes
  while (std::getline(ss, label, '.')) {
    data.push_back(label.length());
    data.insert(data.end(), label.begin(), label.end());
  }
  data.push_back(0);
  return data;
}

std::vector<byte> DNSQuestion::data() const {
  std::vector<byte> data;
  std::vector<byte> encname = EncodeString(name_);
  data.insert(data.end(), encname.begin(), encname.end());
  PushInt16(&data, rrtype_);
  PushInt16(&data, qclass_);
  return data;
}

std::vector<byte> DNSRR::data() const {
  std::vector<byte> data = DNSQuestion::data();
  PushInt32(&data, ttl_);
  return data;
}

std::vector<byte> DNSSingleNameRR::data() const {
  std::vector<byte> data = DNSRR::data();
  std::vector<byte> encname = EncodeString(other_);
  int len = encname.size();
  PushInt16(&data, len);
  data.insert(data.end(), encname.begin(), encname.end());
  return data;
}

std::vector<byte> DNSTxtRR::data() const {
  std::vector<byte> data = DNSRR::data();
  int len = 0;
  for (const std::string& txt : txt_) {
    len += (1 + txt.size());
  }
  PushInt16(&data, len);
  for (const std::string& txt : txt_) {
    data.push_back(txt.size());
    data.insert(data.end(), txt.begin(), txt.end());
  }
  return data;
}

std::vector<byte> DNSMxRR::data() const {
  std::vector<byte> data = DNSRR::data();
  std::vector<byte> encname = EncodeString(other_);
  int len = 2 + encname.size();
  PushInt16(&data, len);
  PushInt16(&data, pref_);
  data.insert(data.end(), encname.begin(), encname.end());
  return data;
}

std::vector<byte> DNSSrvRR::data() const {
  std::vector<byte> data = DNSRR::data();
  std::vector<byte> encname = EncodeString(target_);
  int len = 6 + encname.size();
  PushInt16(&data, len);
  PushInt16(&data, prio_);
  PushInt16(&data, weight_);
  PushInt16(&data, port_);
  data.insert(data.end(), encname.begin(), encname.end());
  return data;
}

std::vector<byte> DNSAddressRR::data() const {
  std::vector<byte> data = DNSRR::data();
  int len = addr_.size();
  PushInt16(&data, len);
  data.insert(data.end(), addr_.begin(), addr_.end());
  return data;
}

std::vector<byte> DNSSoaRR::data() const {
  std::vector<byte> data = DNSRR::data();
  std::vector<byte> encname1 = EncodeString(nsname_);
  std::vector<byte> encname2 = EncodeString(rname_);
  int len = encname1.size() + encname2.size() + 5*4;
  PushInt16(&data, len);
  data.insert(data.end(), encname1.begin(), encname1.end());
  data.insert(data.end(), encname2.begin(), encname2.end());
  PushInt32(&data, serial_);
  PushInt32(&data, refresh_);
  PushInt32(&data, retry_);
  PushInt32(&data, expire_);
  PushInt32(&data, minimum_);
  return data;
}

std::vector<byte> DNSOptRR::data() const {
  std::vector<byte> data = DNSRR::data();
  int len = 0;
  for (const DNSOption& opt : opts_) {
    len += (4 + opt.data_.size());
  }
  PushInt16(&data, len);
  for (const DNSOption& opt : opts_) {
    PushInt16(&data, opt.code_);
    PushInt16(&data, opt.data_.size());
    data.insert(data.end(), opt.data_.begin(), opt.data_.end());
  }
  return data;
}

std::vector<byte> DNSNaptrRR::data() const {
  std::vector<byte> data = DNSRR::data();
  std::vector<byte> encname = EncodeString(replacement_);
  int len = (4 + 1 + flags_.size() + 1 + service_.size() + 1 + regexp_.size() + encname.size());
  PushInt16(&data, len);
  PushInt16(&data, order_);
  PushInt16(&data, pref_);
  data.push_back(flags_.size());
  data.insert(data.end(), flags_.begin(), flags_.end());
  data.push_back(service_.size());
  data.insert(data.end(), service_.begin(), service_.end());
  data.push_back(regexp_.size());
  data.insert(data.end(), regexp_.begin(), regexp_.end());
  data.insert(data.end(), encname.begin(), encname.end());
  return data;
}

std::vector<byte> DNSPacket::data() const {
  std::vector<byte> data;
  PushInt16(&data, qid_);
  byte b = 0x00;
  if (response_) b |= 0x80;
  b |= ((opcode_ & 0x0f) << 3);
  if (aa_) b |= 0x04;
  if (tc_) b |= 0x02;
  if (rd_) b |= 0x01;
  data.push_back(b);
  b = 0x00;
  if (ra_) b |= 0x80;
  if (z_) b |= 0x40;
  if (ad_) b |= 0x20;
  if (cd_) b |= 0x10;
  b |= (rcode_ & 0x0f);
  data.push_back(b);

  int count = questions_.size();
  PushInt16(&data, count);
  count = answers_.size();
  PushInt16(&data, count);
  count = auths_.size();
  PushInt16(&data, count);
  count = adds_.size();
  PushInt16(&data, count);

  for (const std::unique_ptr<DNSQuestion>& question : questions_) {
    std::vector<byte> qdata = question->data();
    data.insert(data.end(), qdata.begin(), qdata.end());
  }
  for (const std::unique_ptr<DNSRR>& rr : answers_) {
    std::vector<byte> rrdata = rr->data();
    data.insert(data.end(), rrdata.begin(), rrdata.end());
  }
  for (const std::unique_ptr<DNSRR>& rr : auths_) {
    std::vector<byte> rrdata = rr->data();
    data.insert(data.end(), rrdata.begin(), rrdata.end());
  }
  for (const std::unique_ptr<DNSRR>& rr : adds_) {
    std::vector<byte> rrdata = rr->data();
    data.insert(data.end(), rrdata.begin(), rrdata.end());
  }
  return data;
}

}  // namespace ares
