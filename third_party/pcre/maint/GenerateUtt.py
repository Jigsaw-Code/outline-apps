#! /usr/bin/python

# Generate utt tables. Note: this script is written in Python 2 and is
# incompatible with Python 3. However, the 2to3 conversion script has been 
# successfully tested on it.

# The source file pcre_tables.c contains (amongst other things), a table that
# is indexed by script name. In order to reduce the number of relocations when
# loading the library, the names are held as a single large string, with
# offsets in the table. This is tedious to maintain by hand. Therefore, this
# script is used to generate the table. The output is sent to stdout; usually
# that should be directed to a temporary file. Then pcre_tables.c can be edited
# by replacing the relevant definitions and table therein with the temporary
# file.

# Modified by PH 17-March-2009 to generate the more verbose form that works
# for UTF-support in EBCDIC as well as ASCII environments.
# Modified by PH 01-March-2010 to add new scripts for Unicode 5.2.0.
# Modified by PH 04-May-2010 to add new "X.." special categories.
# Modified by PH 30-April-2011 to add new scripts for Unicode 6.0.0
# Modified by ChPe 30-September-2012 to add this note; no other changes were
# necessary for Unicode 6.2.0 support.
# Modfied by PH 26-February-2013 to add the Xuc special category.

script_names = ['Arabic', 'Armenian', 'Bengali', 'Bopomofo', 'Braille', 'Buginese', 'Buhid', 'Canadian_Aboriginal', \
 'Cherokee', 'Common', 'Coptic', 'Cypriot', 'Cyrillic', 'Deseret', 'Devanagari', 'Ethiopic', 'Georgian', \
 'Glagolitic', 'Gothic', 'Greek', 'Gujarati', 'Gurmukhi', 'Han', 'Hangul', 'Hanunoo', 'Hebrew', 'Hiragana', \
 'Inherited', 'Kannada', 'Katakana', 'Kharoshthi', 'Khmer', 'Lao', 'Latin', 'Limbu', 'Linear_B', 'Malayalam', \
 'Mongolian', 'Myanmar', 'New_Tai_Lue', 'Ogham', 'Old_Italic', 'Old_Persian', 'Oriya', 'Osmanya', 'Runic', \
 'Shavian', 'Sinhala', 'Syloti_Nagri', 'Syriac', 'Tagalog', 'Tagbanwa', 'Tai_Le', 'Tamil', 'Telugu', 'Thaana', \
 'Thai', 'Tibetan', 'Tifinagh', 'Ugaritic', 'Yi', \
 # New for Unicode 5.0
 'Balinese', 'Cuneiform', 'Nko', 'Phags_Pa', 'Phoenician', \
 # New for Unicode 5.1
 'Carian', 'Cham', 'Kayah_Li', 'Lepcha', 'Lycian', 'Lydian', 'Ol_Chiki', 'Rejang', 'Saurashtra', 'Sundanese', 'Vai', \
 # New for Unicode 5.2
 'Avestan', 'Bamum', 'Egyptian_Hieroglyphs', 'Imperial_Aramaic', \
 'Inscriptional_Pahlavi', 'Inscriptional_Parthian', \
 'Javanese', 'Kaithi', 'Lisu', 'Meetei_Mayek', \
 'Old_South_Arabian', 'Old_Turkic', 'Samaritan', 'Tai_Tham', 'Tai_Viet', \
 # New for Unicode 6.0.0
 'Batak', 'Brahmi', 'Mandaic', \
# New for Unicode 6.1.0
 'Chakma', 'Meroitic_Cursive', 'Meroitic_Hieroglyphs', 'Miao', 'Sharada', 'Sora_Sompeng', 'Takri',
# New for Unicode 7.0.0
 'Bassa_Vah', 'Caucasian_Albanian', 'Duployan', 'Elbasan', 'Grantha', 'Khojki', 'Khudawadi',
 'Linear_A', 'Mahajani', 'Manichaean', 'Mende_Kikakui', 'Modi', 'Mro', 'Nabataean',
 'Old_North_Arabian', 'Old_Permic', 'Pahawh_Hmong', 'Palmyrene', 'Psalter_Pahlavi',
 'Pau_Cin_Hau', 'Siddham', 'Tirhuta', 'Warang_Citi'
 ]

category_names = ['Cc', 'Cf', 'Cn', 'Co', 'Cs', 'Ll', 'Lm', 'Lo', 'Lt', 'Lu',
  'Mc', 'Me', 'Mn', 'Nd', 'Nl', 'No', 'Pc', 'Pd', 'Pe', 'Pf', 'Pi', 'Po', 'Ps',
  'Sc', 'Sk', 'Sm', 'So', 'Zl', 'Zp', 'Zs' ]

general_category_names = ['C', 'L', 'M', 'N', 'P', 'S', 'Z']

# First add the Unicode script and category names.

utt_table  = zip(script_names, ['PT_SC'] * len(script_names))
utt_table += zip(category_names, ['PT_PC'] * len(category_names))
utt_table += zip(general_category_names, ['PT_GC'] * len(general_category_names))

# Now add our own specials.

utt_table.append(('Any', 'PT_ANY'))
utt_table.append(('L&',  'PT_LAMP'))
utt_table.append(('Xan', 'PT_ALNUM'))
utt_table.append(('Xps', 'PT_PXSPACE'))
utt_table.append(('Xsp', 'PT_SPACE'))
utt_table.append(('Xuc', 'PT_UCNC'))
utt_table.append(('Xwd', 'PT_WORD'))

# Sort the table.

utt_table.sort()

# We have to use STR_ macros to define the strings so that it all works in
# UTF-8 mode on EBCDIC platforms.

for utt in utt_table:
        print '#define STRING_%s0' % (utt[0].replace('&', '_AMPERSAND')),
        for c in utt[0]:
                if c == '_':
                        print 'STR_UNDERSCORE',
                elif c == '&':
                        print 'STR_AMPERSAND',
                else:
                        print 'STR_%s' % c,;
        print '"\\0"'

# Print the actual table, using the string names

print ''
print 'const char PRIV(utt_names)[] =';
last = ''
for utt in utt_table:
        if utt == utt_table[-1]:
                last = ';'
        print '  STRING_%s0%s' % (utt[0].replace('&', '_AMPERSAND'), last)
# This was how it was done before the EBCDIC-compatible modification.
#        print '  "%s\\0"%s' % (utt[0], last)

print '\nconst ucp_type_table PRIV(utt)[] = {'
offset = 0
last = ','
for utt in utt_table:
        if utt[1] in ('PT_ANY', 'PT_LAMP', 'PT_ALNUM', 'PT_PXSPACE', 
          'PT_SPACE', 'PT_UCNC', 'PT_WORD'):
                value = '0'
        else:
                value = 'ucp_' + utt[0]
        if utt == utt_table[-1]:
                last = ''
        print '  { %3d, %s, %s }%s' % (offset, utt[1], value, last)
        offset += len(utt[0]) + 1
print '};'
