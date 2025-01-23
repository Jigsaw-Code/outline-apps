#include "go_plugin.h"

void InvokeCallback(CallbackFuncPtr f, const char *data) {
  f(data);
}
