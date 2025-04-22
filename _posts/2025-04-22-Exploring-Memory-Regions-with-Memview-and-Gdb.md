
---
layout: post
author: StevenLwcz
---
### Introduction

Gdb has many commands to help with understanding how memory is laid out and used in a process. It can also show you the internal format of an executable.

What we want to know is the layout of our variables (.data, .bss, .rodata). What is on the heap and the stack? Can we find the environment variables? Can we examine the code areas (.text)? What else can we delve into?

This information can help us with resolving more complex bugs or start exploring a program for vulnerabilities, or just help us learn what is behind the scenes in a running process.
 
```
# commands to start peeling back the layers
(gdb) info proc mappings
(gdb) info file <filename>
(gdb) shell nm <filename>
(gdb) info variable REGEX
```

### Info proc mappings

This command gives a high level view of the *virtual* memory layout of a program. Code exists in the 'x' (executable) area. Normal data will be in the 'rw' (read/write) area. In this example the 'r' only area contains various internal structures for allowing the program to be relocated in physical memory.

If during execution your program uses `malloc()`, then a heap will be created. And every program has a stack for storing local data, function parameters and return values for function calls.

```
# edited output
        0x5555550000       0x5555551000     0x1000        0x0  r-xp   /home/user1/test/a
        0x555556f000       0x5555570000     0x1000     0xf000  r--p   /home/user1/test/a
        0x5555570000       0x5555571000     0x1000    0x10000  rw-p   /home/user1/test/a

        0x5555571000       0x5555592000    0x21000        0x0  rw-p   [heap]

        0x7ffffdf000       0x8000000000    0x21000        0x0  rw-p   [stack]
```

### Info file

This will list a detailed view of ELF for the executable. *.text* our executable code. *.rodata* - read only data for constant items or literals. *.data* is for initialized variables. *.bss* is a technique used to reduce the size of an exe. It is expanded at load time and the area is initialized to zero. Data items which are uninitialized or to zero will be allocated here.


```
# edited highlights
        0x5555550780 - 0x00000055555509b4 is .text
        0x55555509c8 - 0x0000005555550a37 is .rodata

        0x5555570048 - 0x0000005555570070 is .data
        0x5555570070 - 0x0000005555570090 is .bss
```

Check out this link for more in depth detail. ELF.....

You can use the addresses with  `(gdb) memview 0x555570070` or `(gdb) memview 0x555570070`.

### Nm command

Some of these addresses can also be accessed from symbols which either gcc or the ld will add in during the compile and link stages.

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

For more information about the output `man nm`. You can use these symbols with `x` or `memview`.

```
(gdb) memview &__data_start
```

### Info var

An executable will be linked with other libraries typically libc. Some of the above commands will also produce a breakdown of such libraries and their place in the virtual memory space.

You explore symbols in your exe and the libraries with  `info var`

```
(gdb) info var data

x0000000000020048  __data_start
0x0000000000020048  data_start
0x0000000000020070  __bss_start
0x0000000000020070  __bss_start__
```

```
(gdb) info var libc

xxxxxxx
```

### Environment Variables and Command Line Arguments

With a bit of digging around, we can start exploring other interesting symbols and memory areas.

```
(gdb) memview char **__environ
(gdb) memview char **__libc_argv
```

### Code

View the code at main, func1 and the data on the stack.
(gdb) memview main
(gdb) memview func1

### The Stack

There are many ways to look at the stack, for example `info stack`. For a hex dump view you can use the `$sp` register:

```
(gdb) memview $sp
```

### Examining the Heap

`mp_` is an internal structure which holds information about the heap and it contains `sbrk_base` which is the start of the heap.

```
(gdb) print /x mp_
(gdb) memview mp_.sbrk_base
```

### Conclusion

If you want to start looking deeper into how programs are viewed by the operating system or need more advanced tools to track down memory related issues, these advanced commands can help.

With a bigger picture of how things work under the covers, it helps a lot in understanding crash dumps, stack traces or output from memory analysis tools like Valgrind.

You can use `(gdb) x` to view memory in various format and for many things it will be the best option. With being able to view the memory in a nice hex/text view adds another tool to your debugging repertoire.

One last tip. If a symbol has non alphanumeric characters in it, you can still use it with `x` or other commands by placing it in single quotes.

```
memview 'malloc@plt'
```

In the next post we are going to look at how we can use the GDB Python API to search memory and I'm sure that will work its way into another TUI app for GDB.

### References

1. [ELF Format Cheatsheet](https://gist.github.com/x0nu11byt3/bcb35c3de461e5fb66173071a2379779)
2. [(gdb) ELF format]()x](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Memory.html#index-examining-memory)
3. Stackoverflow has many posts which answer questions about using GDB.

