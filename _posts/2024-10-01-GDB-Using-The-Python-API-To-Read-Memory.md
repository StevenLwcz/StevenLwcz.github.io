---
layout: post
author: StevenLwcz
---
### Introduction

In this series of posts we will explore some of the functions from [Inferiors In Python](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Inferiors-In-Python.html#Inferiors-In-Python).

The first few will look at how we can read memory from a process and display it in a memory view TUI, Future posts will look at seaching and writing to memory and a few other interesting things along the way.

### GDB Inferiors

GDB inferiors are just another name for a process. You can see the status of all inferiors in GDB:

```
(gdb) info inferior
  Num  Description       Connection           Executable        
* 1    process 2592      1 (native)           /home/StevenLwcz/post11/a 
```

Using the Python API:
```
(gdb) python
>print(gdb.inferiors())
>end
(<gdb.Inferior num=1, pid=2592>,)
```

If there is no inferior running, GDB returns a default one with pid=0.

```
(gdb) python
>infe = gdb.selected_inferior()
>print(infe.pid)
>print(infe.num)
>end
2592
1
```

The primary use we will put this to later, is to know we have a process running.

### Reading Memory

The Python API ```mv=infe.read_memory(addr, num)``` is used to read memory from a running inferior. infe: the object from ```selected_inferior()```, addr the address to read and the number of bytes to read.
Returned is a [MemoryView](https://docs.python.org/3/c-api/memoryview.html) object.

Addr in the API needs to be an integer, for example: 0x5555550000. If you want to find the memory at the address of a variable or expression like you can with the GDB x command, then we can use ```gdb.parse_and_eval()``` function which will return a ```gdb.Value``` object which has an address property.
```
(gdb) python
>expr = gdb.parse_and_eval('a')
>addr = expr.address if expr.address != None else expr
>print(hex(int(addr)))
>end
0x7fffffef70
```
```
(gdb) python
>mv = infe.read_memory(addr, 32)
>print(mv)
>end
<memory at 0x7f98201300>
```

If the memory at addr can't be read, the API will throw a ```gdb.MemoryError```. When dealing with user input this is something you will need to check and we will use in future.

### The MemView Obejct

The memview object has several methods:
```
(gdb) python
>print(mv.hex(' '))
>end
61 62 63 64 65 66 00 00 20 00 00 00 64 00 00 00 90 f0 ff ff 7f 00 00 00 18 78 e2 f7 7f 00 00 00
```

If we want a text respresentation of the memory then we can convert to bytes and convert to an ANSI code page. One problem here is text will contrain control characters which GDB will compain about

```python
(gdb)python
>text = mv.tobytes().decode('latin-1')
>print(text)
>end
ValueError: embedded null character
Error while executing Python code.
```

One approach is to replace all the control characters with a . using regulart expressions.

```python
>import re
>pattern = re.compile(r'[\x00-\x1f\x7f-\x9f]')
>text =  pattern.sub('.', text)
>print(text)
>end
abcdef.. ...d....ðÿÿ.....xâ÷....
```

### Memory View Display

Looking forward to our memview TUI program, we will want to display the hex and text in a series of rows:
The MemoryView object allows slicing, so we can easily iterate our way over it

```python
(gdb) python
>for i in range(0, 32, 8):
>    m = mv[i:i + 8]
>    text = pattern.sub('.', m.tobytes().decode('latin-1'))
>    print(f"{hex(addr + i)}: {m.hex(' ')} {text}")
>end
0x7fffffef70: 61 62 63 64 65 66 00 00 abcdef..
0x7fffffefa0: 20 00 00 00 64 00 00 00  ...d...
0x7fffffefd0: 90 f0 ff ff 7f 00 00 00 .ðÿÿ....
0x7ffffff000: 18 78 e2 f7 7f 00 00 00 .xâ÷....
```

### Assembly Programming

```gdb.parse_and_eval()``` also works with registers. It will return the value of the register which you can use as an address to ```read_memory()``` as well.

```gdb.parse_and_eval('$x0')```

### Conclusion

In this post we have looked at the documentation for the Pyhon API and other Python classes to read memory and display the output in a nice format similar to what you can find in other IDEs.

We will use these basics to develop a TUI window and add more features like scrolling through the memory in future posts.

In my github you can get [the python code and C demo](https://github.com/StevenLwcz/gdb-python-blog/tree/post11).

```shell
gcc -g -o a a.c
gdb -q a
(gdb) b main
(gdb) r
(gdb) n
(gdb) n
(gdb) so mv.py
```
