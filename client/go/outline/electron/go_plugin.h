#ifndef CALLBACK_H
#define CALLBACK_H

#include <stdlib.h>

// InvokeMethodResult is a struct used to pass result from Go to TypeScript boundary.
typedef struct InvokeMethodResult_t
{
    // A string representing the result of the Go function call.
    // This may be a raw string or a JSON string depending on the API call.
    const char *Output;

    // A string containing a JSON representation of any error that occurred during the
    // Go function call, or NULL if no error occurred.
    // This error can be parsed by the PlatformError in TypeScript.
    const char *ErrorJson;
} InvokeMethodResult;

// CallbackFuncPtr is a C function pointer type that represents a callback function.
// This callback function will be invoked by the Go side.
//
// - data: The callback data, passed as a C string (typically a JSON string).
typedef void (*CallbackFuncPtr)(const char *data);

// Declare the function prototype
void InvokeCallback(CallbackFuncPtr f, const char *data);

#endif // CALLBACK_H
