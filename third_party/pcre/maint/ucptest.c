/***************************************************
* A program for testing the Unicode property table *
***************************************************/

/* Copyright (c) University of Cambridge 2008 */

/* Compile thus:
   gcc -DHAVE_CONFIG_H -o ucptest ucptest.c ../pcre_ucd.c ../pcre_tables.c
*/

/* The program expects to read commands on stdin, and it writes output
to stdout. There is only one command, "findprop", followed by a list of Unicode 
code points as hex numbers (without any prefixes). The output is one line per 
character, giving its Unicode properties followed by its other case if there is 
one. */

#ifdef HAVE_CONFIG_H
#include "../config.h"
#endif

#ifndef SUPPORT_UCP
#define SUPPORT_UCP
#endif

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../pcre_internal.h"
#include "../ucp.h"


/* -------------------------------------------------------------------*/

#define CS   (char *)
#define CCS  (const char *)
#define CSS  (char **)
#define US   (unsigned char *)
#define CUS  (const unsigned char *)
#define USS  (unsigned char **)

/* -------------------------------------------------------------------*/




/*************************************************
*      Print Unicode property info for a char    *
*************************************************/

static void
print_prop(int c)
{
int type = UCD_CATEGORY(c);
int fulltype = UCD_CHARTYPE(c);
int script = UCD_SCRIPT(c);
int gbprop = UCD_GRAPHBREAK(c);
int othercase = UCD_OTHERCASE(c);
int caseset = UCD_CASESET(c);

unsigned char *fulltypename = US"??";
unsigned char *typename = US"??";
unsigned char *scriptname = US"??";
unsigned char *graphbreak = US"??";

switch (type)
  {
  case ucp_C: typename = US"Control"; break;
  case ucp_L: typename = US"Letter"; break;
  case ucp_M: typename = US"Mark"; break;
  case ucp_N: typename = US"Number"; break;
  case ucp_P: typename = US"Punctuation"; break;
  case ucp_S: typename = US"Symbol"; break;
  case ucp_Z: typename = US"Separator"; break;
  }

switch (fulltype)
  {
  case ucp_Cc: fulltypename = US"Control"; break;
  case ucp_Cf: fulltypename = US"Format"; break;
  case ucp_Cn: fulltypename = US"Unassigned"; break;
  case ucp_Co: fulltypename = US"Private use"; break;
  case ucp_Cs: fulltypename = US"Surrogate"; break;
  case ucp_Ll: fulltypename = US"Lower case letter"; break;
  case ucp_Lm: fulltypename = US"Modifier letter"; break;
  case ucp_Lo: fulltypename = US"Other letter"; break;
  case ucp_Lt: fulltypename = US"Title case letter"; break;
  case ucp_Lu: fulltypename = US"Upper case letter"; break;
  case ucp_Mc: fulltypename = US"Spacing mark"; break;
  case ucp_Me: fulltypename = US"Enclosing mark"; break;
  case ucp_Mn: fulltypename = US"Non-spacing mark"; break;
  case ucp_Nd: fulltypename = US"Decimal number"; break;
  case ucp_Nl: fulltypename = US"Letter number"; break;
  case ucp_No: fulltypename = US"Other number"; break;
  case ucp_Pc: fulltypename = US"Connector punctuation"; break;
  case ucp_Pd: fulltypename = US"Dash punctuation"; break;
  case ucp_Pe: fulltypename = US"Close punctuation"; break;
  case ucp_Pf: fulltypename = US"Final punctuation"; break;
  case ucp_Pi: fulltypename = US"Initial punctuation"; break;
  case ucp_Po: fulltypename = US"Other punctuation"; break;
  case ucp_Ps: fulltypename = US"Open punctuation"; break;
  case ucp_Sc: fulltypename = US"Currency symbol"; break;
  case ucp_Sk: fulltypename = US"Modifier symbol"; break;
  case ucp_Sm: fulltypename = US"Mathematical symbol"; break;
  case ucp_So: fulltypename = US"Other symbol"; break;
  case ucp_Zl: fulltypename = US"Line separator"; break;
  case ucp_Zp: fulltypename = US"Paragraph separator"; break;
  case ucp_Zs: fulltypename = US"Space separator"; break;
  }
  
switch(gbprop)
  {
  case ucp_gbCR:           graphbreak = US"CR"; break;
  case ucp_gbLF:           graphbreak = US"LF"; break;
  case ucp_gbControl:      graphbreak = US"Control"; break;
  case ucp_gbExtend:       graphbreak = US"Extend"; break;
  case ucp_gbPrepend:      graphbreak = US"Prepend"; break;
  case ucp_gbSpacingMark:  graphbreak = US"SpacingMark"; break;
  case ucp_gbL:            graphbreak = US"Hangul syllable type L"; break;
  case ucp_gbV:            graphbreak = US"Hangul syllable type V"; break;
  case ucp_gbT:            graphbreak = US"Hangul syllable type T"; break;
  case ucp_gbLV:           graphbreak = US"Hangul syllable type LV"; break;
  case ucp_gbLVT:          graphbreak = US"Hangul syllable type LVT"; break;
  case ucp_gbOther:        graphbreak = US"Other"; break;
  }

switch(script)
  {
  case ucp_Arabic:      scriptname = US"Arabic"; break;
  case ucp_Armenian:    scriptname = US"Armenian"; break;
  case ucp_Balinese:    scriptname = US"Balinese"; break;
  case ucp_Bengali:     scriptname = US"Bengali"; break;
  case ucp_Bopomofo:    scriptname = US"Bopomofo"; break;
  case ucp_Braille:     scriptname = US"Braille"; break;
  case ucp_Buginese:    scriptname = US"Buginese"; break;
  case ucp_Buhid:       scriptname = US"Buhid"; break;
  case ucp_Canadian_Aboriginal: scriptname = US"Canadian_Aboriginal"; break;
  case ucp_Cherokee:    scriptname = US"Cherokee"; break;
  case ucp_Common:      scriptname = US"Common"; break;
  case ucp_Coptic:      scriptname = US"Coptic"; break;
  case ucp_Cuneiform:   scriptname = US"Cuneiform"; break;
  case ucp_Cypriot:     scriptname = US"Cypriot"; break;
  case ucp_Cyrillic:    scriptname = US"Cyrillic"; break;
  case ucp_Deseret:     scriptname = US"Deseret"; break;
  case ucp_Devanagari:  scriptname = US"Devanagari"; break;
  case ucp_Ethiopic:    scriptname = US"Ethiopic"; break;
  case ucp_Georgian:    scriptname = US"Georgian"; break;
  case ucp_Glagolitic:  scriptname = US"Glagolitic"; break;
  case ucp_Gothic:      scriptname = US"Gothic"; break;
  case ucp_Greek:       scriptname = US"Greek"; break;
  case ucp_Gujarati:    scriptname = US"Gujarati"; break;
  case ucp_Gurmukhi:    scriptname = US"Gurmukhi"; break;
  case ucp_Han:         scriptname = US"Han"; break;
  case ucp_Hangul:      scriptname = US"Hangul"; break;
  case ucp_Hanunoo:     scriptname = US"Hanunoo"; break;
  case ucp_Hebrew:      scriptname = US"Hebrew"; break;
  case ucp_Hiragana:    scriptname = US"Hiragana"; break;
  case ucp_Inherited:   scriptname = US"Inherited"; break;
  case ucp_Kannada:     scriptname = US"Kannada"; break;
  case ucp_Katakana:    scriptname = US"Katakana"; break;
  case ucp_Kharoshthi:  scriptname = US"Kharoshthi"; break;
  case ucp_Khmer:       scriptname = US"Khmer"; break;
  case ucp_Lao:         scriptname = US"Lao"; break;
  case ucp_Latin:       scriptname = US"Latin"; break;
  case ucp_Limbu:       scriptname = US"Limbu"; break;
  case ucp_Linear_B:    scriptname = US"Linear_B"; break;
  case ucp_Malayalam:   scriptname = US"Malayalam"; break;
  case ucp_Mongolian:   scriptname = US"Mongolian"; break;
  case ucp_Myanmar:     scriptname = US"Myanmar"; break;
  case ucp_New_Tai_Lue: scriptname = US"New_Tai_Lue"; break;
  case ucp_Nko:         scriptname = US"Nko"; break;
  case ucp_Ogham:       scriptname = US"Ogham"; break;
  case ucp_Old_Italic:  scriptname = US"Old_Italic"; break;
  case ucp_Old_Persian: scriptname = US"Old_Persian"; break;
  case ucp_Oriya:       scriptname = US"Oriya"; break;
  case ucp_Osmanya:     scriptname = US"Osmanya"; break;
  case ucp_Phags_Pa:    scriptname = US"Phags_Pa"; break;
  case ucp_Phoenician:  scriptname = US"Phoenician"; break;
  case ucp_Runic:       scriptname = US"Runic"; break;
  case ucp_Shavian:     scriptname = US"Shavian"; break;
  case ucp_Sinhala:     scriptname = US"Sinhala"; break;
  case ucp_Syloti_Nagri: scriptname = US"Syloti_Nagri"; break;
  case ucp_Syriac:      scriptname = US"Syriac"; break;
  case ucp_Tagalog:     scriptname = US"Tagalog"; break;
  case ucp_Tagbanwa:    scriptname = US"Tagbanwa"; break;
  case ucp_Tai_Le:      scriptname = US"Tai_Le"; break;
  case ucp_Tamil:       scriptname = US"Tamil"; break;
  case ucp_Telugu:      scriptname = US"Telugu"; break;
  case ucp_Thaana:      scriptname = US"Thaana"; break;
  case ucp_Thai:        scriptname = US"Thai"; break;
  case ucp_Tibetan:     scriptname = US"Tibetan"; break;
  case ucp_Tifinagh:    scriptname = US"Tifinagh"; break;
  case ucp_Ugaritic:    scriptname = US"Ugaritic"; break;
  case ucp_Yi:          scriptname = US"Yi"; break;
  /* New for Unicode 5.1: */
  case ucp_Carian:      scriptname = US"Carian"; break;
  case ucp_Cham:        scriptname = US"Cham"; break;
  case ucp_Kayah_Li:    scriptname = US"Kayah_Li"; break;
  case ucp_Lepcha:      scriptname = US"Lepcha"; break;
  case ucp_Lycian:      scriptname = US"Lycian"; break;
  case ucp_Lydian:      scriptname = US"Lydian"; break;
  case ucp_Ol_Chiki:    scriptname = US"Ol_Chiki"; break;
  case ucp_Rejang:      scriptname = US"Rejang"; break;
  case ucp_Saurashtra:  scriptname = US"Saurashtra"; break;
  case ucp_Sundanese:   scriptname = US"Sundanese"; break;
  case ucp_Vai:         scriptname = US"Vai"; break;
  /* New for Unicode 5.2: */
  case ucp_Avestan:     scriptname = US"Avestan"; break;
  case ucp_Bamum:       scriptname = US"Bamum"; break;
  case ucp_Egyptian_Hieroglyphs: scriptname = US"Egyptian_Hieroglyphs"; break;
  case ucp_Imperial_Aramaic: scriptname = US"Imperial_Aramaic"; break;
  case ucp_Inscriptional_Pahlavi: scriptname = US"Inscriptional_Pahlavi"; break;
  case ucp_Inscriptional_Parthian: scriptname = US"Inscriptional_Parthian"; break;
  case ucp_Javanese:    scriptname = US"Javanese"; break;
  case ucp_Kaithi:      scriptname = US"Kaithi"; break;
  case ucp_Lisu:        scriptname = US"Lisu"; break;
  case ucp_Meetei_Mayek: scriptname = US"Meetei_Mayek"; break;
  case ucp_Old_South_Arabian: scriptname = US"Old_South_Arabian"; break;
  case ucp_Old_Turkic:  scriptname = US"Old_Turkic"; break;
  case ucp_Samaritan:   scriptname = US"Samaritan"; break;
  case ucp_Tai_Tham:    scriptname = US"Tai_Tham"; break;
  case ucp_Tai_Viet:    scriptname = US"Tai_Viet"; break;
  /* New for Unicode 6.0.0 */
  case ucp_Batak:       scriptname = US"Batak"; break;
  case ucp_Brahmi:      scriptname = US"Brahmi"; break;
  case ucp_Mandaic:     scriptname = US"Mandaic"; break;

  /* New for Unicode 6.1.0 */
  case ucp_Chakma:               scriptname = US"Chakma"; break;
  case ucp_Meroitic_Cursive:     scriptname = US"Meroitic_Cursive"; break;
  case ucp_Meroitic_Hieroglyphs: scriptname = US"Meroitic_Hieroglyphs"; break;
  case ucp_Miao:                 scriptname = US"Miao"; break;
  case ucp_Sharada:              scriptname = US"Sharada"; break;
  case ucp_Sora_Sompeng:         scriptname = US"Sora Sompent"; break;
  case ucp_Takri:                scriptname = US"Takri"; break;

  /* New for Unicode 7.0.0 */
  case ucp_Bassa_Vah:          scriptname = US"Bassa_Vah"; break;
  case ucp_Caucasian_Albanian: scriptname = US"Caucasian_Albanian"; break;
  case ucp_Duployan:           scriptname = US"Duployan"; break;
  case ucp_Elbasan:            scriptname = US"Elbasan"; break;
  case ucp_Grantha:            scriptname = US"Grantha"; break;
  case ucp_Khojki:             scriptname = US"Khojki"; break;
  case ucp_Khudawadi:          scriptname = US"Khudawadi"; break;
  case ucp_Linear_A:           scriptname = US"Linear_A"; break;
  case ucp_Mahajani:           scriptname = US"Mahajani"; break;
  case ucp_Manichaean:         scriptname = US"Manichaean"; break;
  case ucp_Mende_Kikakui:      scriptname = US"Mende_Kikakui"; break;
  case ucp_Modi:               scriptname = US"Modi"; break;
  case ucp_Mro:                scriptname = US"Mro"; break;
  case ucp_Nabataean:          scriptname = US"Nabataean"; break;
  case ucp_Old_North_Arabian:  scriptname = US"Old_North_Arabian"; break;
  case ucp_Old_Permic:         scriptname = US"Old_Permic"; break;
  case ucp_Pahawh_Hmong:       scriptname = US"Pahawh_Hmong"; break;
  case ucp_Palmyrene:          scriptname = US"Palmyrene"; break;
  case ucp_Psalter_Pahlavi:    scriptname = US"Psalter_Pahlavi"; break;
  case ucp_Pau_Cin_Hau:        scriptname = US"Pau_Cin_Hau"; break;
  case ucp_Siddham:            scriptname = US"Siddham"; break;
  case ucp_Tirhuta:            scriptname = US"Tirhuta"; break;
  case ucp_Warang_Citi:        scriptname = US"Warang_Citi"; break;
  }

printf("%04x %s: %s, %s, %s", c, typename, fulltypename, scriptname, graphbreak);
if (othercase != c) 
  {
  printf(", %04x", othercase);
  if (caseset != 0)
    {
    const pcre_uint32 *p = PRIV(ucd_caseless_sets) + caseset - 1;
    while (*(++p) < NOTACHAR)
      if (*p != othercase && *p != c) printf(", %04x", *p);
    }   
  } 
printf("\n");
}



/*************************************************
*               Main program                     *
*************************************************/

int
main(void)
{
unsigned char buffer[1024];
while (fgets(CS buffer, sizeof(buffer), stdin) != NULL)
  {
  unsigned char name[24];
  unsigned char *s, *t;

  printf("%s", buffer);
  s = buffer;
  while (isspace(*s)) s++;
  if (*s == 0) continue;

  for (t = name; *s != 0 && !isspace(*s); s++) *t++ = *s;
  *t = 0;
  while (isspace(*s)) s++;

  if (strcmp(CS name, "findprop") == 0)
    {
    while (*s != 0)
      {
      unsigned char *endptr;
      int c = strtoul(CS s, CSS(&endptr), 16);
      print_prop(c);
      s = endptr;
      while (isspace(*s)) s++;
      }
    }

  else printf("Unknown test command %s\n", name);
  }

return 0;
}

/* End */
