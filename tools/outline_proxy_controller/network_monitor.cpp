/**
 * @file network_monitor.cpp
 * @author The Outline Authors
 * @brief
 * This file contains the implementation code of network_monitor.h.
 *
 * @copyright Copyright (c) 2022 The Outline Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <array>
#include <cstddef>      // size_t, byte
#include <cstring>      // memset
#include <system_error>
#include <type_traits>  // underlying_type_t, is_integral

#include <linux/netlink.h>
#include <linux/rtnetlink.h>

#include <boost/asio.hpp>

#include "logger.h"
#include "network_monitor.h"

using namespace outline;

static const std::size_t kRecvBufferSize = 4096;

NetworkMonitor::NetworkMonitor(const boost::asio::any_io_executor &io_context)
  : netlink_socket_{io_context}
{
  using namespace boost::asio::generic;

  sockaddr_nl sa;
  std::memset(&sa, 0, sizeof(sa));
  sa.nl_family = AF_NETLINK;
  sa.nl_groups = RTMGRP_LINK         // network card change
               | RTMGRP_IPV4_IFADDR  // IPv4 address change
               | RTMGRP_IPV4_ROUTE   // IPv4 route table change
               | RTMGRP_IPV6_IFADDR  // IPv6 address change
               | RTMGRP_IPV6_ROUTE;  // IPv6 route table change

  netlink_socket_.open({AF_NETLINK, NETLINK_ROUTE});
  netlink_socket_.bind({&sa, sizeof(sa)});

  // for non-blocking peek IsNextChangeEventReady
  netlink_socket_.non_blocking(true);

  logger.info("network monitor initialized");
}

NetworkMonitor::~NetworkMonitor() {
  logger.info("network monitor destroyed");
}

boost::asio::awaitable<NetworkChangeEvent> NetworkMonitor::WaitForChangeEvent() {
  using namespace boost::asio;

  std::array<std::byte, kRecvBufferSize> buf;
  NetworkChangeEvent received_events;

  do {
    auto len = co_await netlink_socket_.async_receive(buffer(buf), use_awaitable);

    // https://linux.die.net/man/7/netlink
    // https://man7.org/linux/man-pages/man7/rtnetlink.7.html
    for (auto msg = reinterpret_cast<nlmsghdr*>(buf.data()); NLMSG_OK(msg, len); msg = NLMSG_NEXT(msg, len)) {
      switch (msg->nlmsg_type) {
        case NLMSG_DONE:
          goto EndOfMultiPartMsg;
        case NLMSG_ERROR:
        {
          auto err = reinterpret_cast<nlmsgerr*>(NLMSG_DATA(msg));
          throw std::system_error{err->error, std::system_category()};
        }
        case RTM_NEWLINK:
          received_events.SetNicChanged();
          break;
        case RTM_NEWADDR:
        case RTM_DELADDR:
          received_events.SetAddressChanged();
          break;
        case RTM_NEWROUTE:
        case RTM_DELROUTE:
          received_events.SetRoutingChanged();
          break;
      }
    }

EndOfMultiPartMsg:
    ;

    // We use IsNextChangeEventReady here because netlink events are noisy.
    // For example, our "connect to Outline" operation itself will lead to ~10
    // change events, and all of the events are immediately ready in the buffer.
    // So instead of co_returning ~10 times (with the same network condition),
    // I tried to aggregate them all and just co_return once.
  } while (received_events.IsEmpty() || IsNextChangeEventReady());

  co_return received_events;
}

bool NetworkMonitor::IsNextChangeEventReady() {
  std::array<std::byte, 1> buf;
  boost::system::error_code err;

  // receive won't block because we already set `netlink_socket_.non_blocking(true)`
  auto len = netlink_socket_.receive(boost::asio::buffer(buf), netlink_socket_.message_peek, err);
  return !err && len > 0;
}


static const unsigned int kNicChanged     = 0b00000001;
static const unsigned int kAddressChanged = 0b00000010;
static const unsigned int kRouteChanged   = 0b00000100;

bool NetworkChangeEvent::IsEmpty() const noexcept {
  return type_ == 0;
}

void NetworkChangeEvent::SetNicChanged() noexcept {
  type_ |= kNicChanged;
}

bool NetworkChangeEvent::HasNicChanged() const noexcept {
  return type_ & kNicChanged;
}

void NetworkChangeEvent::SetAddressChanged() noexcept {
  type_ |= kAddressChanged;
}

bool NetworkChangeEvent::HasAddressChanged() const noexcept {
  return type_ & kAddressChanged;
}

void NetworkChangeEvent::SetRoutingChanged() noexcept {
  type_ |= kRouteChanged;
}

bool NetworkChangeEvent::HasRoutingChanged() const noexcept {
  return type_ & kRouteChanged;
}
