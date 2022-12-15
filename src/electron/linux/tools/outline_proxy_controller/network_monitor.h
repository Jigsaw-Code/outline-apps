/**
 * @file network_monitor.h
 * @author The Outline Authors
 * @brief
 * This file contains interface definitions of a Linux ip table monitor.
 * Callers can use it to receive routing and link updates change events.
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

#pragma once

#include <string>

#include <boost/asio/any_io_executor.hpp>
#include <boost/asio/awaitable.hpp>
#include <boost/asio/generic/raw_protocol.hpp>

namespace outline {

/**
 * @brief The network change event descriptor.
 */
class NetworkChangeEvent final {
public:
  /** @brief Indicate whether any network environment has changed or not. */
  bool IsEmpty() const noexcept;
  /** @brief Determine whether the network interface card has changed. */
  bool HasNicChanged() const noexcept;
  /** @brief Determine whether the IPv4 or IPv6 address has changed. */
  bool HasAddressChanged() const noexcept;
  /** @brief Determine whether the routing table (v4 or v6) has changed. */
  bool HasRoutingChanged() const noexcept;

public:
  /** @brief Mark that the network interface card has changed. */
  void SetNicChanged() noexcept;
  /** @brief Mark that the IPv4 or IPv6 address has changed. */
  void SetAddressChanged() noexcept;
  /** @brief Mark that the routing table (v4 or v6) has changed. */
  void SetRoutingChanged() noexcept;

private:
  /**
   * @brief The raw bit flags representing the kind of network change event.
   */
  unsigned int type_ = 0;
};

/**
 * @brief Provide methods to receive various network related change
 *        notifications asynchronously using Linux netlink API.
 */
class NetworkMonitor final {
public:
  /**
   * @brief Construct a new NetworkMonitor object. Please note that this
   *        constructor may throw errors if the OS does not support the
   *        required netlink socket protocol.
   *
   * @param io_context Any Boost ASIO executor (like io_context) which will be
   *                   passed to the underlying socket.
   */
  NetworkMonitor(const boost::asio::any_io_executor &io_context);
  ~NetworkMonitor();

private:
  // Non-copyable or moveable
  NetworkMonitor(const NetworkMonitor &) = delete;
  NetworkMonitor& operator=(const NetworkMonitor &) = delete;
  NetworkMonitor(NetworkMonitor &&) noexcept = delete;
  NetworkMonitor& operator=(NetworkMonitor &&) noexcept = delete;

public:
  /**
   * @brief Asynchronously wait for the next network change event.
   * @remarks thread unsafe, at most one outstanding call.
   *
   * @return boost::asio::awaitable<NetworkChangeEvent> One or more network
   *         change event flag(s).
   */
  boost::asio::awaitable<NetworkChangeEvent> WaitForChangeEvent();

private:
  /**
   * @brief Is the next event already in the receiving buffer. This is a
   *        non-blocking function and will return immediately.
   */
  bool IsNextChangeEventReady();

private:
  boost::asio::generic::raw_protocol::socket netlink_socket_;
};

}
