#!/bin/sh

# Running aclocal here first (as happened for a while) caused the macros that
# libtoolize puts in the m4 directory to be newer than the aclocal.m4 file that
# aclocal creates. This meant that the next "make" cause aclocal to be run
# again. Moving aclocal to after libtoolize does not seem to cause any
# problems, and it fixes this issue.

# GNU libtool is named differently on some systems.  This code tries several
# variants like glibtoolize (MacOSX) and libtoolize1x (FreeBSD)

set +ex
echo "Looking for a version of libtoolize (which can have different names)..."
libtoolize=""
for l in glibtoolize libtoolize15 libtoolize14 libtoolize ; do
    $l --version > /dev/null 2>&1
    if [ $? = 0 ]; then
        libtoolize=$l
        echo "Found $l" 
        break
    fi
    echo "Did not find $l" 
done

if [ "x$libtoolize" = "x" ]; then
    echo "Can't find libtoolize on your system"
    exit 1
fi

set -ex
$libtoolize -c -f
rm -rf autom4te.cache Makefile.in aclocal.m4
aclocal --force -I m4
autoconf -f -W all,no-obsolete
autoheader -f -W all

# Added no-portability to suppress automake 1.12's warning about the use
# of recursive variables.

automake -a -c -f -W all,no-portability

rm -rf autom4te.cache
exit 0

# end autogen.sh
