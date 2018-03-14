# Where to find the c-ares source code; needed because the tests use library-internal headers
ARES_SRC_DIR = ..
# Where to find the built c-ares static library
ARES_BLD_DIR = ..
AUTOMAKE_OPTIONS = foreign
ACLOCAL_AMFLAGS = -I ../m4
GMOCK_DIR = gmock-1.7.0
GTEST_DIR = $(GMOCK_DIR)/gtest
# Note use of -isystem to force use of local gMock/gTest even if there's an installed version.
CPPFLAGS += -I$(ARES_SRC_DIR) -isystem $(GTEST_DIR)/include -isystem $(GMOCK_DIR)/include
CXXFLAGS += -Wall $(PTHREAD_CFLAGS)

# Makefile.inc provides the TESTSOURCES, TESTHEADERS and FUZZSOURCES defines
include Makefile.inc

TESTS = arestest fuzzcheck.sh

noinst_PROGRAMS = arestest aresfuzz aresfuzzname dnsdump
arestest_SOURCES = $(TESTSOURCES) $(TESTHEADERS)
arestest_LDADD = libgmock.la libgtest.la $(ARES_BLD_DIR)/libcares.la $(PTHREAD_LIBS)

# Not interested in coverage of test code, but linking the test binary needs the coverage option
@CODE_COVERAGE_RULES@
arestest_LDFLAGS = $(CODE_COVERAGE_LDFLAGS)

noinst_LTLIBRARIES = libgmock.la libgtest.la

libgmock_la_SOURCES = $(GMOCK_DIR)/src/gmock-all.cc			\
  $(GMOCK_DIR)/src/gmock-cardinalities.cc				\
  $(GMOCK_DIR)/src/gmock-internal-utils.cc				\
  $(GMOCK_DIR)/src/gmock-matchers.cc					\
  $(GMOCK_DIR)/src/gmock-spec-builders.cc				\
  $(GMOCK_DIR)/src/gmock.cc						\
  $(GMOCK_DIR)/include/gmock/gmock-cardinalities.h			\
  $(GMOCK_DIR)/include/gmock/gmock-generated-matchers.h		\
  $(GMOCK_DIR)/include/gmock/gmock-more-actions.h			\
  $(GMOCK_DIR)/include/gmock/gmock-actions.h				\
  $(GMOCK_DIR)/include/gmock/gmock-generated-actions.h			\
  $(GMOCK_DIR)/include/gmock/gmock-matchers.h				\
  $(GMOCK_DIR)/include/gmock/gmock-generated-function-mockers.h	\
  $(GMOCK_DIR)/include/gmock/gmock.h					\
  $(GMOCK_DIR)/include/gmock/gmock-generated-nice-strict.h		\
  $(GMOCK_DIR)/include/gmock/gmock-spec-builders.h			\
  $(GMOCK_DIR)/include/gmock/internal/gmock-internal-utils.h		\
  $(GMOCK_DIR)/include/gmock/internal/gmock-generated-internal-utils.h	\
  $(GMOCK_DIR)/include/gmock/internal/gmock-port.h			\
  $(GMOCK_DIR)/include/gmock/gmock-more-matchers.h

libgmock_la_CPPFLAGS = -isystem $(GTEST_DIR)/include -I$(GTEST_DIR) -isystem $(GMOCK_DIR)/include -I$(GMOCK_DIR)

libgtest_la_SOURCES = $(GTEST_DIR)/src/gtest-all.cc			\
  $(GTEST_DIR)/src/gtest.cc						\
  $(GTEST_DIR)/src/gtest-death-test.cc					\
  $(GTEST_DIR)/src/gtest-filepath.cc					\
  $(GTEST_DIR)/src/gtest-port.cc					\
  $(GTEST_DIR)/src/gtest-printers.cc					\
  $(GTEST_DIR)/src/gtest-test-part.cc					\
  $(GTEST_DIR)/src/gtest-typed-test.cc					\
  $(GTEST_DIR)/src/gtest-internal-inl.h				\
  $(GTEST_DIR)/include/gtest/gtest-test-part.h				\
  $(GTEST_DIR)/include/gtest/gtest-param-test.h			\
  $(GTEST_DIR)/include/gtest/gtest-printers.h				\
  $(GTEST_DIR)/include/gtest/gtest-message.h				\
  $(GTEST_DIR)/include/gtest/gtest.h					\
  $(GTEST_DIR)/include/gtest/gtest_pred_impl.h				\
  $(GTEST_DIR)/include/gtest/gtest-death-test.h			\
  $(GTEST_DIR)/include/gtest/gtest-spi.h				\
  $(GTEST_DIR)/include/gtest/gtest-typed-test.h			\
  $(GTEST_DIR)/include/gtest/internal/gtest-filepath.h			\
  $(GTEST_DIR)/include/gtest/internal/gtest-param-util-generated.h	\
  $(GTEST_DIR)/include/gtest/internal/gtest-type-util.h		\
  $(GTEST_DIR)/include/gtest/internal/gtest-string.h			\
  $(GTEST_DIR)/include/gtest/internal/gtest-port.h			\
  $(GTEST_DIR)/include/gtest/internal/gtest-param-util.h		\
  $(GTEST_DIR)/include/gtest/internal/gtest-death-test-internal.h	\
  $(GTEST_DIR)/include/gtest/internal/gtest-linked_ptr.h		\
  $(GTEST_DIR)/include/gtest/internal/gtest-internal.h			\
  $(GTEST_DIR)/include/gtest/internal/gtest-tuple.h			\
  $(GTEST_DIR)/include/gtest/gtest_prod.h

libgtest_la_CPPFLAGS = -isystem $(GTEST_DIR)/include -I$(GTEST_DIR) -isystem $(GMOCK_DIR)/include -I$(GMOCK_DIR)

aresfuzz_SOURCES = $(FUZZSOURCES)
aresfuzz_LDADD = $(ARES_BLD_DIR)/libcares.la

aresfuzzname_SOURCES = $(FUZZNAMESOURCES)
aresfuzzname_LDADD = $(ARES_BLD_DIR)/libcares.la

dnsdump_SOURCES = $(DUMPSOURCES)
dnsdump_LDADD = $(ARES_BLD_DIR)/libcares.la

test: check
