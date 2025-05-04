---
layout: post
author: StevenLwcz
descriptio: GDB, Low level debugging, searching memory, GDB tips, Conveniance variables.
---

### Introduction

Being able to easily search memory and data structures is useful for debugging and exploring programs. It can help you find corrupted data, locate specific code sections or data structures to check they are correct, reverse engineering and more.

In this post we will look at the GDB command `find` [^1] and how it can be used to different types of variables and memory regions. We will also look at GDB convenience variables and how they can help in some scenarios.

### Find

```
)gdb) help find
find [/SIZE-CHAR] [/MAX-COUNT] START-ADDRESS, END-ADDRESS, EXPR1 [, EXPR2 ...]
find [/SIZE-CHAR] [/MAX-COUNT] START-ADDRESS, +LENGTH, EXPR1 [, EXPR2 ...]
...
The address of the last match is stored as the value of "$_".
Convenience variable "$numfound" is set to the number of matches
```

`START-ADDRESS` & `END-ADDRESS` can be a memory address `0x......`, an address of a variable `&a1`, or a pointer.

`/SIZE-CHAR' says how many bytes to use for the expression. `/w` would treat `0x60` as '0x60000000' depending on the byte order.

The length can be a number or the return value from a function. You may get an error about not knowing the return type which is why in the following examples, `(int)` will be used.

Note the commas are required, you can get strange error messages if you miss them.

### Searching Arrays

```c
int a1[] = {12,34,56,78,90,34,45,67,89};
```

Some quick C basics. `a1` is a pointer to the first element in the array. `a1[0]` and `*a1` are the same. You can get hold of the 3rd element by `*(a1 + 2)`. `a1` used in `sizeof(a1)` gives the size of the whole array: 36.

`&a` is the address to the whole array `int (*)[9]`. This time `&a1 + 1` points to the address directly after the array [^2][^3]. By comparison `sizeof(&a1)` gives us 8 on a 64 bit platform.

This gives us two ways to define the address range for searching an array.

```gdb
find /w &a1, &a1 + 1, 23
find /w a1, +(sizeof(a1)), 23

0x555557006c <a1+4>
0x555557007c <a1+20>
```

To search for floating point numbers you need to use a cast on the expression.

```C
float f1 = {1.1, 2.2, 3.3};
(gdb) find &f1, &f1 + 1, (float)1.1
0x5555570090 <f1>
```

### Searching Strings

In this format a null terminated string is searched for and we need to specify the string length + 1 to include the null in the search space.

```C
char *s1 = "Red Orange Yellow Green Blue Indigo Red Violet";

(gdb) find s1, +(int)strlen(s1) + 1, "Violet"
0x5555550ac0
```

To search within a string, we need to cast the string to a character array. `{type}addr` [^4] allows you to treat the memory at an address as a certain type. Here a character array of 3.

```
(gdb) find s1, +(int)strlen(s1), {char [3]}"Red"
0x5555550a98
0x5555550abc
```

### Searching A Heap Allocated String

If you have a block of memory allocated by malloc() you want to search, hopefully you have a variable with the length in it, but you can also use the function `malloc_usable_size()[^5]`.

```C
    char *s2 = malloc(0x100000); 
    memset(s2, 'x', 0x10000);
    memcpy(s2 + 400, "Red", 3);
    memcpy(s2 + 1400, "Red", 3);

(gdb) find s2, +malloc_usable_size(s2), {char [3]}"Red"
0x7ff7cff1a0
0x7ff7cff588
```

If you want to search the whole heap, then you can use `info proc mappings` to get the address range. Note allocation of large blocks may be in a separate memory block, as in this example.

```
(gdb) info proc map
        0x5555571000       0x5555592000    0x21000        0x0  rw-p   [heap]
        0x7ff7cff000       0x7ff7e00000   0x101000        0x0  rw-p   
```

### Searching Memory Regions

To search the data area in your process, you can use the symbols we looked at in the previous post.

```
(gdb) find &data_start, &__bss_end__, {char [4]}"glob"
0x5555570060 <c>
```

### Searching Text and Read Only

If you want to search the text area or the read only area, you can use `info file` to find the addresses.

```
(gdb) info file
        0x0000005555550780 - 0x0000005555550988 is .text
        0x00000055555509a0 - 0x00000055555509ff is .rodata
(gdb) find 0x055555509a0, 0x55555509ff, {char [3]}"Red"
0x55555509b8
0x55555509dc
```

Don't forget `layout asm` for a low level assembler view of the text region.

In the next post we will look at using the Python GDB API to create some convenience variables for these addresses.

### Conveniences Variables

You can create convenience variables and write simple scripts in GDB [^6].

````
set $myvar1="Hello"
set $mynum=100
set $mynum+=1
```

To see the currently defines one you can use:

```
(gdb) show conv
$mynum = 101
$myvar1 = "hello"
$_ = (void *) 0x55555509f0
$numfound = 3
```

### Searching the Environment Space

You can list all the environment variables or list one particular one

```
(gdb) show environ
(gdb) show environ HOME
```

If you want to use `find` to search this area, you need to know the start which we already know is `\*environ`. We also want either the length or the end address. There are several ways to do this. However we want to use as many GDB features as we can! We will use conveiance variables and GDBs script commands [^7]. Here we will create a GDB script and define a function alled `calc_env_size`.

The environment block is an array of strings with the last one being 0x00. You can use `x` or `memview` to verify this. All we need to do is use `environ` to loop through all the strings and add their lengths.

env.txt:
```
define calc_env_size
  set $i = 0
  set $env_size = 0
  while (environ[$i])
    # print "%s\n", environ[$i]
    set $env_size += (int)strlen(environ[$i]) + 1
    set $i += 1
  end
  printf "Number of environment variables=%d\n", $i - 1
  printf "$env_size=%d\n", $env_size
end
```

```
(gdb) so env.txt
(gdb) calc_env_size
Number of environment variables=41
$env_size=2967
```

Now we are ready to search the environment space. Lets search for a value and find out what environment variable it belongs to. Since the address is stored in the conveniance variable `$_` we can immediately use that with `x` to display the data around the result.

```
(gdb) find *environ, +$env_size, {char [5]"xterm"
0x7ffffffd69
(gdb) x /s ($_ - 5)
0x7ffffffd64:   "TERM=xterm-256color"
```

### Searching the Stack

GDB has various commands for helping you see the current state of the stack `info frame` and `info locals`.

The output is quite detailed. We can see the range of the arguments to the functions (Arglist) and
the range of the local items (Locals).

```
(gdb) print $sp
$48 = (void *) 0x7fffffef30

(gdb) info locals
l1 = 100
l2 = 100
d = "func1 "

(gdb) info frame
Stack level 0, frame at 0x7fffffef50:
 pc = 0x55555508cc in func1 (a.c:33); saved pc = 0x555555097c
 called by frame at 0x7fffffef90
 source language c.
 Arglist at 0x7fffffef30, args: p1=100, p2=100
 Locals at 0x7fffffef30, Previous frame's sp is 0x7fffffef50
```

Other commands  like `x` and `memview` might help you get a better appreciation of what is on the stack. You can still search it.

```
(gdb) find 0x7fffffef30, 0x7fffffef50, {char [5]}"func1"
0x7fffffef40
```

Stack corruption is a frequent source of bugs, so being able to find that return address or spot that something is not correct, could help you solve another bug.

### Conclusion

We have gone into quite a lot of detail using `find` in various scenarios picking up lots of little tricks along the way with using conveiance variables, scripting and information from the previous post. Even if you are not searching memory or varaibles, they are still useful techniques. Good luck with your low level debugging.

In the next post we will look at some GDB Python APIs and Python scripting to aid with making using `find` more useful and potentially easier to use.

### References

[^1]: [find](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Searching-Memory.html#index-find)
[^2]: [Pointers in C](https://www.geeksforgeeks.org/pointer-array-array-pointer)
[^3]: [Pointers in C]([https://stackoverflow.com/questions/2528318/how-come-an-arrays-address-is-equal-to-its-value-in-c)
[^4]: [{type}](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Expressions.html#index-_007btype_007d)
[^5]: [malloc_usable_size()](https://linux.die.net/man/3/malloc_usable_size)
[^6]: [Convenience Variables](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Convenience-Vars.html#Convenience-Vars)
[^7]: [GDB Scripting](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Command-Files.html#index-scripting-commands)

