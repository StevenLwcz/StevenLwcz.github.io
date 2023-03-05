---
layout: post
author: StevenLwcz
---
### Introduction

One of my main motivations for learning the Python API for GDB is precisely this. GDB is great for debugging assembler on low memory single board computers. The register window in GDB (layout src, layout reg) displays all registers in all formats. It may be complete but it makes keeping track of specific registers difficult when debugging assembler. Better would be a window just like you can in normal IDEs just to add the registers you are interested in at any particular moment. 

This is what we will develop in this post. We will build on all the techniques of the previous posts so we will just focus on how to access registers in Python in GDB and develop a Python class to help display them in a versatile way, in hex or binary as desired. I have already written something similar for ARM but as of late I have also been exploring RISC-V assembler. All the Python APIs work for ARM as well.


I have various files in my [git hub repostitory](https://github.com/StevenLwcz/gdb-python-blog/tree/post10) which will be used as part of this post.

Included is blog10.s, a small assembler program to convert a number from binary to ascii and display it to the screen.


```shell
$ make -f makefile.blog10
$ gdb -q blog10
```

### Reading Registers in Python

To read registers using the GDB Python API we call the `(read_register(name))[https://sourceware.org/gdb/onlinedocs/gdb/Frames-In-Python.html#Frames-In-Python]` method. The name can be the number based register x0-x31 or the ABI alias (a0,t0,...).. `read_register()` returns a gdb.Value object and can be converted to a string using `format_string(format=FMT)` where FMT is one of `(gdb) print /FMT` options. Some registers predominantly hold addresses (pc, ra, sp) and so display in hex by default.


```
(gdb) shell cat blog10.py
frame = gdb.selected_frame()
r1 = frame.read_register("a2")
r2 = frame.read_register("x12")
r3 = frame.read_register("pc")
r4 = frame.read_register("ra")
r5 = frame.read_register("sp")
r6 = frame.read_register("a1")
print("a2", r1.format_string(format='x'))
print("x12", r2)
print("pc", r3)
print("ra", r4)
print("sp", r5)
print("a1", r6.format_string(format='z'))
```

```
(gdb) so blog10.py
a2 0xd
x12 13
pc 0x1014c <print>
ra 0x100e0 <_start_+14>
sp 0x3ffffff5c0
a1 0x000000000001116c
```

### Framework for a Custom Register Window

What we shall do is hold all the registers to display in a Python dictionary which is created by the command line handling part of the program. I won’t look into this since it is just all normal Python programming.


For the register window we want to iterate through this dictionary and build up lines of text to render to the window later. In my previous applications I’ve had a lot of logic in these ‘create window’ functions to handle lots of scenarios. In this one I take a different approach which is to delegate such logic to a class which knows how to deal with the specific kind of value we want to handle.

```python
    def create_register(self):
    …
        for name, reg in self.regs.items():
            reg.update_value()
   
            line += f'{GREEN}{name:<5}{reg:<24}'
    
        self.render()
```

We are going to handle all the colour, formatting, value updating in a class called Register.

```shell
(gdb) shell cat blog10b.py
```

**[blog10b.py](https://github.com/StevenLwcz/gdb-python-blog/blob/post10/blog10b.py)**
```python
class Register(object):

    frame = None

    def __init__(self, name):
        self.name = name
        self.fmt = 'd'
        self.val = None
        self.colour = None


    def update_value(self):
        val = Register.frame.read_register(self.name)
        self.colour = BLUE if self.val != val else WHITE
        self.val = val

r1 = Register(‘a0’)
r1.update_value()
print(r1.val)
```

To use r1 in an f-string `f”{r1:<24)”` and apply blue if the value has changed we implement our own `__format__` function.


```python
    def __format__(self, format_spec):
        return self.colour + format(str(self), format_spec)
```

See Python docs for the `format()` function. To apply any specific format specifiers we will also implement our own `__str__` function which is used by the `str()` function.


```python
    # use GDB format_string{} to convert to Python string
    def __str__(self):
        return self.val.format_string(format=self.fmt)
```


It you try to use a gdb.Value object in a f-string you will get a error like this:


    #  Typerror: unsupported format string passed to gdb.Value.__format__


which is just another way of saying it seems to me, gdb.Value does not support `__format__`.  We can test it out


**[blog10b.py](https://github.com/StevenLwcz/gdb-python-blog/blob/post10/blog10b.py)**
```
Register.frame = gdb.selected_frame()
r1.update_value()
print(f"{GREEN}{r1.name:<5}{r1:<24}{RESET}X")
r1.update_value()
print(f"{GREEN}{r1.name:<5}{r1:<24}{RESET}X")


r1.fmt = 'x'
print(f"{GREEN}{r1.name:<5}{r1:<24}{RESET}X")


r2 = Register('pc')
r2.update_value()
r2.fmt = 'a'
print(f"{GREEN}{r2.name:<5}{r2:<24}{RESET}X")


(gdb) so blog10b.py
```

### Other Register Type

The a, t and s registers normally we would want to display them as signed integers and for pc, sp, etc in hex using the ‘a’ address format specifier. We will introduce a new class to do this


```python
class AdReg(Register):

    def __init__(self, name):
        super().__init__(name)
        self.fmt = 'a'
```

Other classes with the fine grain needed can be created to support single and floating point registers and other special cases.

### Custom Register Window

As per the patterns we have used in previous posts on GDB Tui Python programming we are ready to create our new register window. Window scrolling, saving the Register state to reload later are all included: [general-riscv.py](https://github.com/StevenLwcz/gdb-python/blob/main/general-riscv.py). To use this just uncomment all the commented lines in blog10.gdb.gdb. 

```shell
$ gdb -q blog10
```

![Register Window RISC-V](/images/RegisterWindow10.png)

You can view the help with  `(gdb) help reg`.

![GDB Window Help](/images/RegisterWindowHelp10.png)

### Conclusion

This post shows how to write a register window for RISC-V which matches features you would find in a modern IDE, allowing greater ease when debugging assembler. Reading registers in Python in GDB is straightforward and formatting  (hex, binary) is pretty easy. There is not much code because we are building up on and refining patterns from previous posts. The next post will mention floating point registers in RISV-V.

Check out other GDB Python programs for ARM on my github repository. Happy assembler debugging,


