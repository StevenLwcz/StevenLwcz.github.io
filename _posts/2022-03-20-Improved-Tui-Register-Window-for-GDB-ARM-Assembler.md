---
layout: post
author: StevenLwcz
description: Using the GDB Python API to create an improved register TUI window for ARM 32 and 64 bit. Configure which registers to display and in what format.
---

### Introduction

GDB 10.0 introduced a Python API to allow you to create your own custom 
[Tui Windows in Python](https://sourceware.org/gdb/onlinedocs/gdb/TUI-Windows-In-Python.html).

I've created a `register` Tui Window and `register` GDB command, that allows you to display a custom list of general, single, double and vector registers. This allows you to focus only on a small set of registers while debugging a piece of assembler. You can toggle individual registers to display in hex, signed, unsigned or float format.

    Armv8a: r, s, d and q
    AArch64: x, w, s, d, v, b, h, q

It also highlights any changed values since the previous step. The window is also scrollable. The Python program [general.py](https://github.com/StevenLwcz/gdb-python/blob/main/general.py) works for both AArch64 and Armv8-a.

### Using `register` and Enabling the `register` Custom Window

Best set up is to create a GDB command file.

**a1-gdb.gdb** auto load GDB command file

    # include the Python script
    so general.py
    # create a new Tui layout including the new custom window register
    tui new-layout debug1 register 1 src 2 status 0 cmd 1
    # enable the layout
    layout debug1
    # all general registers plus special ones
    reg x0 - x30 pc sp cpsr
    # or a small focus selection
    reg x0 - x4 d0 - d6 s0 - s3
    # display some in hex 
    reg hex on x5 - x10

```shell
 $ gdb -q a1
```

### The Register Command

    (gdb) help reg
    Add registers to the custom TUI Window register.
    register OPT|/FMT register-list
    /FMT: x: hex, z: zero pad hex, s: signed, u: unsigned, f: float
    OPT: del register-list
        clear - clear all registers from the window
    Ranges can be specified with -:
    register x0 x10 - x15 s0 s4 - s6 d5 - d9 w0 x10 - w15
    Special registers: lr, pc, sp, cpsr, fpsr, fpcr

### GDB Commands for Tui Control

You can still change the layout in GDB.
 
    (gdb) layout reg


Then back again to the custom layout

    (gdb) layout debug1

The last set of registers from before will be restored.

Gain focus to scroll the window with the up and down cursor keys or mouse scroll button.

    (gdb) focus register

### Misc Commands for the Tui Interface

Info about current layout

    (gdb) info win

Get focus on a particular window

    (gdb) focus [name]

Change window heights

    (gdb) wh register +4

Display all layouts

    (gdb) layout

Enable/disable Tui

    (gdb) tui [enable|disable]

### More Tips

You can use the GDB history to easily recover previous 'register' commands and switch between 
different custom register lists. To your .gdbinit file add the following and see the gdb docs for more info.

    set history save

If when quitting GDB the command prompt no longer display properly try this to restore it.

```shell
 $ stty sane
```

### Known Issues
Tui disable messes up GDB. This is because tui.is_valid() is not set to False. I think this might be fixed in a later version of GDB according to the docs. You will probably have to use `$ stty sane` if you do `(gdb) tui disable` and then quit GDB.

### Other

For better display of vector registers see [vector.py](https://github.com/StevenLwcz/gdb-python/blob/main/vector.py)

[general.py](https://github.com/StevenLwcz/gdb-python/blob/main/general.py) is a rewrite of 
[aarch64pp.py](https://github.com/StevenLwcz/gdb-python/blob/main/aarch64pp.py) and 
[armv8-app.py](https://github.com/StevenLwcz/gdb-python/blob/main/armv8-a.py), which had a lot of code duplication and unwieldy code when building up the register view.
[general.py](https://github.com/StevenLwcz/gdb-python/blob/main/general.py) creates classes for each register type which allows each class to deal with the specific `gdb.Value` object returned by `read_register()`
which mean the main code to build up the register view no longer has to worry to much about what kind of register it is.

