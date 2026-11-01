import ctypes,ctypes.util,sys
lib=ctypes.CDLL(ctypes.util.find_library('JavaScriptCore'))
ptr=ctypes.c_void_p
lib.JSGlobalContextCreate.argtypes=[ptr];lib.JSGlobalContextCreate.restype=ptr
lib.JSGlobalContextRelease.argtypes=[ptr]
lib.JSStringCreateWithUTF8CString.argtypes=[ctypes.c_char_p];lib.JSStringCreateWithUTF8CString.restype=ptr
lib.JSStringRelease.argtypes=[ptr]
lib.JSEvaluateScript.argtypes=[ptr,ptr,ptr,ptr,ctypes.c_int,ctypes.POINTER(ptr)];lib.JSEvaluateScript.restype=ptr
lib.JSValueToStringCopy.argtypes=[ptr,ptr,ctypes.POINTER(ptr)];lib.JSValueToStringCopy.restype=ptr
lib.JSStringGetMaximumUTF8CStringSize.argtypes=[ptr];lib.JSStringGetMaximumUTF8CStringSize.restype=ctypes.c_size_t
lib.JSStringGetUTF8CString.argtypes=[ptr,ctypes.c_char_p,ctypes.c_size_t];lib.JSStringGetUTF8CString.restype=ctypes.c_size_t
ctx=lib.JSGlobalContextCreate(None)
source=lib.JSStringCreateWithUTF8CString(sys.stdin.buffer.read())
exc=ptr()
value=lib.JSEvaluateScript(ctx,source,None,None,1,ctypes.byref(exc))
failed=bool(exc.value)
string=lib.JSValueToStringCopy(ctx,exc.value if failed else value,None)
size=lib.JSStringGetMaximumUTF8CStringSize(string)
buf=ctypes.create_string_buffer(size)
lib.JSStringGetUTF8CString(string,buf,size)
print(buf.value.decode('utf8'))
lib.JSStringRelease(string);lib.JSStringRelease(source);lib.JSGlobalContextRelease(ctx)
if failed:sys.exit(1)
