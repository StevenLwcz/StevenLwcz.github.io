---
layout: post
author: StevenLwcz
---

In this post we are going to look at displaying NEON SIMD vector registers in GDB, how to do the same with the Python API and then create an improved vector register window. It will mostly talk about AArch64 but will cover Armv8-a at the end.

### AArch64

[Code In Arm Assembly Lanes and Loads in NEON](https://eclecticlight.co/2021/08/23/code-in-arm-assembly-lanes-and-loads-in-neon
) is a great introduction to NEON SIMD in AArch64. 

Before we can start looking at GDB and vector registers we need to start debugging a small assembly program. Use [blog5.s](https://github.com/StevenLwcz/gdb-python-blog/blob/main/blog5.s), [makefile.blog5](https://github.com/StevenLwcz/gdb-python-blog/blob/main/makefile.blog5).

```shell
$ make -f makefile.blog5
```

**[blog5-gdb,gdb](https://github.com/StevenLwcz/gdb-python-blog/blob/main/blog5-gdb.gdb)** auto load gdb command file.

```
b _start
r
layout src
```
```shell
$ gdb -q ./blog5
```
The vector registers `v0-v31` can be used with `print`, `display` and other commands.
```shell
(gdb) print $v0
$1 = {d = {f = {0, 0}, u = {0, 0}, s = {0, 0}}, s = {f = {0, 0, 0, 0}, u = {0, 0, 0, 0}, s = {0, 0, 0, 0}},
  h = {f = {0, 0, 0, 0, 0, 0, 0, 0}, u = {0, 0, 0, 0, 0, 0, 0, 0}, s = {0, 0, 0, 0, 0, 0, 0, 0}}, b = {u = {
      0 <repeats 16 times>}, s = {0 <repeats 16 times>}}, q = {u = {0}, s = {0}}}
```

GDB displays a rather large collection of unions. There are unions for 128 bits: q, 64 bits: d, 32 bits: s, 16 bits: h and 8 bits: b. 
C’s structure member syntax can be used to display the inner unions.

```shell
(gdb) p $v0.d
$3 = {f = {0, 0}, u = {0, 0}, s = {0, 0}}
(gdb) p $v0.s.f
$9 = {0, 0, 0, 0}
```

Individual elements can use accessed using the array syntax.

```shell
(gdb) p $v0.s.f[2]
$10 = 0
```

`(gdb) set` can be used to set elements or whole unions.
```shell
(gdb) set $v0.s.f[2] = 1
(gdb) set $v0.s.f = {1,1,1,1}
(gdb) p $v0.s
$14 = {f = {1, 1, 1, 1}, u = {1065353216, 1065353216, 1065353216, 1065353216}, s = {1065353216, 1065353216,
    1065353216, 1065353216}}
```

You can view all the vector registers with `(gdb) info`. This produces a rather unwieldy list of all the registers, also including b, h, s, d and q registers. Everything is displayed in normal and hex mode. It is not the most easy to use output.

You can also use the Tui Windows to display all the vector registers.

```shell
(gdb) layout reg
(gdb) tui reg vector
```

Again we get the full dump of unions, normal and hex. In my version of GDB the window is broken. 
`(gdb) focus reg` and use the arrow keys to scroll, it just goes blank.

What would be nice is a register window where we can add the specific vector registers we are interested in, at the level of the structure we want to see. 

The Python API to read a register value is `read_register()` which needs a frame object.

```shell
(gdb) python 
>frame = gdb.selected_frame()
>val = frame.read_register("v0")
>print(val)
>end

{d = {f = {0, 0}, u = {0, 0}, s = {0, 0}}, s = {f = {0, 0, 0, 0}, u = {0, 0, 0, 0}, s = {0, 0, 0, 0}}, ...
```

We get the same structure as before. This time we can use Python’s dictionary and array syntax to access the inner parts as well as individual elements.

**[blog5.py](https://github.com/StevenLwcz/gdb-python-blog/blob/main/blog5.py)** 

```python
frame = gdb.selected_frame()
val = frame.read_register("v0")
print("d.f", val['d']['f'])
print("s.u", val['s']['u'])
print("h.s", val['h']['s'])
print("b.u", val['b']['u'])
print("d.s[0] ", val['d']['s'][0])
print("d.s[1] ", val['d']['s'][1])
```
```python
(gdb) so blog5.py
d.f {0, 0}
s.u {0, 0, 0, 0}
h.s {0, 0, 0, 0, 0, 0, 0, 0}
b.u {0 <repeats 16 times>}
d.s[0]  0
d.s[1]  0
```

In GDB you can print registers in hex with `(gdb) p /x $v0.d.u`. With the Python API you can use `format_string()` with the key argument `format`. 
See [Values From Inferior](https://sourceware.org/gdb/onlinedocs/gdb/Values-From-Inferior.html#Values-From-Inferior) for more information.

**blog5.py**

```python
print("d.u ", val['d']['u'].format_string(format="x"))
d.u  {0x0, 0x0}
```

To create a new Tui Window we use the framework build up in [Tui Windows Part 1-4](https://stevenlwcz.github.io). 
`(gdb) vector` will be the name of the command and the method `create_vector()` will build up a list which the `render()` method will write to the Tui Window.

To add vector registers to the window, we will use similar syntax already used by GDB.
Print needs the $ to differentiate from a variable, but we don’t need to worry about that. 

```shell
(gdb) vector v0 v1.d.f v2.s.u  b3.u h4.f s5.f d7.u 
```

The hard part is the command line parsing and dealing with user typos. The command line will get turned into a dictionary of attributes to store in a dictionary of register names.

```python
class VectorWindow(object):

    save_vector = {}

    def __init__(self, tui):
        self.tui = tui
        self.vector = VectorWindow.save_vector
        self.tui.title = "Vector Registers"
        self.start = 0
        self.list = []


    def add_vector(self, name, width, type, hex):
        self.vector[name] = {'width': width, 'type': type, 'val': None, 'hex': hex}
```

It is already anticipating a hex mode and highlighting of changed values.

The `create_vector()` method then uses the dictionary syntax we used in blog5.py in combination with f-strings to build up the view for the new vector register window.

```python
        for name, attr in self.vector.items():
            val = frame.read_register(name)
            hint = BLUE if attr['val'] != val  else WHITE
            self.vector[name]['val'] = val

            width = attr['width']
            type = attr['type']


                if width:
                    st = val[width][type].format_string(repeat_threshold=0) if type else val[width]
                else:
                    st = val[type] if type else val

            self.list.append(f'{GREEN}{name:<5}{hint}{st}{RESET}{NL}')
```

For `v0.b.u`,  `v0.b.s` I decided I wanted to display the full array instead of the `{0 <repeats 16 times>}`.
The `repeat_threshold` key argument to `format_string()` is used to make sure the contents are expanded.

Values can be converted to hex with `format_string(format=”z”)`. `Z` is a zero pad hex version.

When GDB converts a floating point number to hex it just treats it as an integer. The only use case I can think of displaying floats in hex is if you are interested in the IEEE floating point format, hence the little tweak.

```python
            if attr['hex']:
                type = 'u' if type == 'f' else type
                if width:
                    st = val[width][type].format_string(format='z', repeat_threshold=0) if type else val[width].format_string(format='z')
                else:
                    st = val[type].format_string(format='z') if type else val.format_string(format='z')
```

The `render()` method is the same from the previous blog and allows scrolling which will be a very useful feature if you want to display a lot of vector registers.

Download the code for [vector.py](https://github.com/StevenLwcz/gdb-python/blob/main/vector.py). Update the GDB command file.

**[blog5-gdb,gdb](https://github.com/StevenLwcz/gdb-python-blog/blob/main/blog5-gdb.gdb)**.

```
set style enabled off
b _start
r
so vector.py
tui new-layout debug1 vector 1 src 1 status 0 cmd 1
layout debug1

vector v0.b.u v1.h.u
vector v2.s.s v3.d.s
vector v4.h.f v5.s.f v6.d.f

focus vector
```
```shell
$ gdb -q ./blog5
```
```shell
(gdb) s
[Press Return 6 times to repeat]
```
![Vector Register Window](/images/TuiWindow5.png)

Change `v0` from showing unsigned to signed and since there are no other gdb commands which begin with v:
```shell
(gdb) v v0.b.u
```
Use the `/x` option to show a register in hex. Repeat withoushow t the `/x` option to go back to normal.
```shell
(gdb) v /x v0.b.u
```

### Armv8-a

[blog5_32.s](https://github.com/StevenLwcz/gdb-python-blog/blob/main/blog5_32.s) for the 32 bit assembly version.
[makefile.blog5](https://github.com/StevenLwcz/gdb-python-blog/blob/main/makefile.blog5) has a ***32*** target.

**blog5-gdb.gdb** auto load command file.
```
b _start
r
layout src
```

```shell
$ make -f makefile.blog5 32
$ gdb -q blog5
```

There are only 2 vector registers in Armv8-a d and q. There is only one level of unions for each.

```shell
(gdb) print $q0
$1 = {u8 = {0 <repeats 16 times>}, u16 = {0, 0, 0, 0, 0, 0, 0, 0}, u32 = {0, 0, 0, 0}, u64 = {0, 0}, f32 = {0, 0, 0, 0}, f64 = {0, 0}}
(gdb) print $q0.u16
$2 = {0, 0, 0, 0, 0, 0, 0, 0}
(gdb) print $q0.f64[1]
$3 = 0
(gdb) print $d0
$4 = {u8 = {0, 0, 0, 0, 0, 0, 0, 0}, u16 = {0, 0, 0, 0}, u32 = {0, 0}, u64 = 0, f32 = {0, 0}, f64 = 0}
(gdb) print $d0.u8
$5 = {0, 0, 0, 0, 0, 0, 0, 0}
(gdb) print $d0.f32[0]
$6 = 0 
```

All the existing code in *vector.py* works fine, it just needs a new routine to parse the 32 bit registers. Python has an API to give the machine architecture, which is used to be able to work with both 32 and 64 bit.

```python
import machine from platform
print(machine())
```

The `vector` command again follows the GDB syntax for accessing the unions for the d and q registers. 
```shell
(gdb) vector q0.u8 q1.u16
(gdb) v /x q3.u64

```
Download [blog5_32.gdb](https://github.com/StevenLwcz/gdb-python-blog/blob/main/blog5_32.gdb) which has all the Tui and vector commands needed for the demo.
```shell
$ gdb -q blog5 -x blog5_32.gdb
```
```
(gdb) s
[Press Return to continue to step through the program]
```

![Vector Register Window 32bit](/images/TuiWindow5_32.png)

### Final Thoughts

With various `vector reg-list` in your GDB command file, as you step through your assembly program, it should now be much easier to see what is going as you explore Arm vector instructions.

`(gdb) vector /d reg-list` allows you to delete registers and `/c` clear the whole window. `(gdb) help vector` for more info.

What next? Allowing array syntax `v0.s.u[0]`. Perhaps an option `vector /fdu v0 v1` to specify the width and type for all the registers on the command line.

In Armv8-a the various forms of *fmov* and *fdup* can be used to set up vector register. In AArch64 they have been expanded into *fmov*, *orr*, *dup*, *smov*, *umov*, *movi* and *ins*. Lucikly you can use *mov* as an alias for most. *ins* is also more powerful than *fmov* by allowing direct element to element moves.

In the next blog we will look at some of these instructions and we can use our brand new vector window to navigate through them.
