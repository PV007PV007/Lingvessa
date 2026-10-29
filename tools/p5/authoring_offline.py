"""Fail-closed Linux network restriction for local, unpublished audio authoring.

The kernel filter also covers native model libraries and child processes. It only
restricts this process and descendants; it cannot grant or bypass any capability.
"""
import ctypes
import ctypes.util
import errno
import json
import platform
import sys

_installed = None


def install():
    global _installed
    if _installed is not None:
        return _installed
    if platform.system() != 'Linux':
        raise RuntimeError('Fail closed: this authoring command requires Linux seccomp')
    library = ctypes.util.find_library('seccomp')
    if not library:
        raise RuntimeError('Fail closed: libseccomp is unavailable')
    sec = ctypes.CDLL(library, use_errno=True)
    sec.seccomp_init.argtypes = [ctypes.c_uint32]
    sec.seccomp_init.restype = ctypes.c_void_p
    sec.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
    sec.seccomp_syscall_resolve_name.restype = ctypes.c_int
    sec.seccomp_rule_add.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint]
    sec.seccomp_rule_add.restype = ctypes.c_int
    sec.seccomp_load.argtypes = [ctypes.c_void_p]
    sec.seccomp_load.restype = ctypes.c_int
    sec.seccomp_release.argtypes = [ctypes.c_void_p]
    context = sec.seccomp_init(0x7FFF0000)  # SCMP_ACT_ALLOW except the denied network syscalls.
    if not context:
        raise RuntimeError('Cannot allocate seccomp filter')
    denied = ['socket', 'socketpair', 'connect', 'sendto', 'sendmsg', 'sendmmsg']
    try:
        for name in denied:
            number = sec.seccomp_syscall_resolve_name(name.encode())
            if number < 0 or sec.seccomp_rule_add(context, 0x00050000 | errno.EPERM, number, 0) != 0:
                raise RuntimeError('Cannot deny native syscall: ' + name)
        if sec.seccomp_load(context) != 0:
            raise RuntimeError('Cannot load seccomp filter; authoring is forbidden')
    finally:
        sec.seccomp_release(context)
    # Direct libc probe bypasses Python auditing but must still be denied by the kernel.
    libc = ctypes.CDLL(None, use_errno=True)
    libc.socket.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int]
    libc.socket.restype = ctypes.c_int
    result = libc.socket(2, 1, 0)  # AF_INET / SOCK_STREAM, no address, no packet.
    observed = ctypes.get_errno()
    if result != -1 or observed != errno.EPERM:
        if result >= 0:
            libc.close(result)
        raise RuntimeError('Native network-denial probe failed')
    def guard(event, args):
        if event in ('socket.connect', 'socket.getaddrinfo'):
            raise RuntimeError('Offline authoring rejects Python socket connection and DNS')
    sys.addaudithook(guard)
    _installed = {'kernel': 'Linux seccomp', 'denied_syscalls': denied,
                  'native_socket_probe': 'EPERM', 'inherited_by_children': True,
                  'python_socket_and_dns_audit': True}
    return _installed


if __name__ == '__main__':
    print(json.dumps(install()))
