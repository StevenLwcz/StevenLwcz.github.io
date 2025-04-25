---
layout: post
author: StevenLwcz
description: Learn how to use GDB to explore memory regions in detail. This guide covers `info proc mappings`, `info file`, `nm`, the heap, stack, and more. Includes practical examples and `memview` tips.
categories: [memory]
---

### Introduction

Have you had to look at a crash dump and don't know where to start?  Understanding how memory is used in a program is crucial for debugging memory leaks, understanding program behaviour, security analysis, crash dumps and more.

Gdb has many commands to help with understanding how memory is laid out and used in a process as well as show you the internal format of an executable.

In this post we will find out the layout of our variables (.data, .bss, .rodata). What is on the heap and the stack? Where we can find the environment variables? How to examine the code areas (.text)? And more. 

I'll be highlighting *memview*[^3] which gives a hex/ascii view of the region from the previous post. All examples can work with `(gdb) x /16c` (might need to tweak the address expression).

```
# commands to start peeling back the layers
(gdb) info proc mappings
(gdb) info file <filename>
(gdb) shell nm <filename>
(gdb) info variable REGEX
```

### Info proc mappings

When we start exploring memory regions in GDB or other tools, what we will be looking at is the *virtual memory* view of the process. Virtual memory is the system in which the OS provides a process a continuous memory address space, hiding all the details of physical memory [^7].

`info proc mappings` gives a high level view of the *virtual memory* layout of a process. Code exists in the 'x' (executable) area. Normal data will be in the 'rw' (read/write) area. In this example the 'r' only area contains various internal structures for allowing the program to be relocated in physical memory.

If during execution your program uses `malloc()` to allocate memory, then a *heap* will be created. Every program has a *stack* for storing local data, function parameters and return values for function calls.

```
# edited output
        0x5555550000       0x5555551000     0x1000        0x0  r-xp   /home/user1/test/a
        0x555556f000       0x5555570000     0x1000     0xf000  r--p   /home/user1/test/a
        0x5555570000       0x5555571000     0x1000    0x10000  rw-p   /home/user1/test/a

        0x5555571000       0x5555592000    0x21000        0x0  rw-p   [heap]

        0x7ffffdf000       0x8000000000    0x21000        0x0  rw-p   [stack]
```

### Info file

You can use this for a detailed view of the executable format (ELF)[^1]. Executable code is in *.text*. *.rodata* - read only data for constant items or literals. *.data* is for initialized variables. *.bss* is a technique used to reduce the size of an exe. It is expanded at load time and the area is initialized to zero. Data items which are uninitialized or to zero will be allocated here.

```
# edited highlights
        0x5555550780 - 0x00000055555509b4 is .text
        0x55555509c8 - 0x0000005555550a37 is .rodata

        0x5555570048 - 0x0000005555570070 is .data
        0x5555570070 - 0x0000005555570090 is .bss
```
You can use the addresses with  `(gdb) memview 0x555570070` or `(gdb) x /16c  0x555570070`.

### Nm command

Nm is an Linux tool for listing symbols in a object file. For convenience we can stay in GDB and run it using the `shell` command.

Some of the addresses like `0x5555570048 .data` can also be accessed from symbols which either the C compiler (gcc) or the linker (ld) will add in during the compile and link stages and *nm* can dump these for us.

```
(gdb) shell nm a

# edited output
0000000000020090 B __bss_end__
0000000000020090 B _bss_end__
0000000000020070 B __bss_start
0000000000020070 B __bss_start__
0000000000020048 D __data_start
0000000000020048 W data_start
00000000000009dc T _fini
0000000000000894 T func1
00000000000009f8 R i1
0000000000000a00 R i2
0000000000020058 D i3
000000000002008c B i4
00000000000008e0 T main
0000000000020068 D s1
0000000000000780 T _start
```

```
B .bss
T .text
D .data
R .rodata
```

```
(gdb) memview &__data_start
```

For more information about the output `man nm`. You can use these symbols with `x` or `memview`.

There is also `(gdb) maint info sections` which does something similar. There are other tools related to `nm` which are `objdump` and `readelf, which also produce similar output.

#### objdump

My favourite option for looking at Arm and Risc-V assembler. Dump the read only section in a hex/text format.

```bash
$ objdump -d -M no-aliases a
$ objdump -s -j .rodata a
```
```
a.out:     file format elf64-littleaarch64

Contents of section .rodata:
 0990 01000200 00000000 beadcafe 00000000  ................
 09a0 11223344 55667788 40205265 64204f72  ."3DUfw.@ Red Or
 09b0 616e6765 2059656c 6c6f7720 47726565  ange Yellow Gree
 09c0 6e20426c 75652049 6e646967 6f205669  n Blue Indigo Vi
```

#### readelf

```bash
$ readelf -x .rodata <object_file>
```

```
Hex dump of section '.rodata':
  0x000009f0 01000200 00000000 beadcafe 00000000 ................
  0x00000a00 11223344 55667788 40205265 64204f72 ."3DUfw.@ Red Or
  0x00000a10 616e6765 2059656c 6c6f7720 47726565 ange Yellow Gree
  0x00000a20 6e20426c 75652049 6e646967 6f205669 n Blue Indigo Vi
```

Handy if you don't want to use GDB. Check out the command line help for these commands for more info.

### Info var

An executable will be linked with other libraries typically libc. Some of the above commands will also produce a breakdown of such libraries and their place in the virtual memory space.

You can explore symbols in your exe and the libraries with `info var`

```
(gdb) info var data

x0000000000020048  __data_start
0x0000000000020048  data_start
0x0000000000020070  __bss_start
0x0000000000020070  __bss_start__
```

```
(gdb) info var libc

33:     int __libc_argc;
34:     char **__libc_argv;
```

### Environment Variables and Command Line Arguments

With a bit of digging around, we can start exploring other interesting symbols and memory areas.

```
(gdb) memview **__environ
(gdb) memview **__libc_argv
```

Environment variables may hold sensitive information like passwords and other system configuration. A classic attack on any program is testing out validation of the command line arguments. You may be surprised what you see.

### Code

View the code at `main()`, `func1()`.

```
(gdb) memview main
(gdb) memview func1
```

You can also use `(gdb) layout asm` to get an assembler view of the code.

If a symbol has non alphanumeric characters in it, you can still use it with `x` or other commands by placing it in single quotes.

```
memview 'malloc@plt'  # this routine is a stub into the real routine in libc.
```

### The Stack

There are many ways to look at the stack, for example `info stack`. For a hex dump view you can use the `$sp` register:

```
(gdb) memview $sp
```

Step through a program and when you first enter a function, see if you can spot the return address on the stack. 

Most security issues are caused by buffer overflows which aim to replace this retrun address with something which will cause execution of malicious code.

### Examining the Heap

`mp_` is an internal structure which holds information about the heap and it contains `sbrk_base` which is the start of the heap.

```
(gdb) print /x mp_
(gdb) memview mp_.sbrk_base
```
 
It is an advanced topic, but you could start following the chain of blocks allocated by `malloc()` and see dynamic allocation algorithms in process.

### Conclusion

For looking deeper into how programs are viewed by the operating system or need more advanced tools to track down memory related issues, these advanced commands can help.

With a better understanding of the underlying memory layout helps in understanding crash dumps, stack traces or output from memory analysis tools like Valgrind.

You can use `(gdb) x` to view memory in various format and for many things it will be the best option[^5]. With being able to view the memory in a nice hex/text view adds another tool to your debugging repertoire. Explore the demo[^4].

This is only the beginning, the deeper you look, the more questions you will have[^2]. Happy debugging!

In the next post we are going to look at how we can use the GDB Python API to search memory and I'm sure that will work its way into another TUI app for GDB.

-------------------
If you want to go even deeper, there are loads of resources on the internet. I'm sure your favourite search engine can help you. Just be wary of AI. I have found on topics like this, since it is not part of their mainstream training data, they like to make up what they don't know. 

### References

[^1]: [ELF Format Cheatsheet](https://gist.github.com/x0nu11byt3/bcb35c3de461e5fb66173071a2379779)
[^2]: [Stackoverflow has many posts which answer questions about using GDB.](https://stackoverflow.com/questions/tagged/gdb)
[^3]: [memview](https://stevenlwcz.github.io/2024/10/21/A-Memory-View-Tui-Window-For-Gdb.html)
[^4]: [Full code and annotated C demo](https://github.com/StevenLwcz/gdb-python-blog/blob/post12)
[^5]: [(gdb) x](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Memory.html#index-examining-memory)
[^7]: [Introduction to Virual Memory](https://performanceengineeringin.wordpress.com/2019/11/04/understanding-virtual-memory)
