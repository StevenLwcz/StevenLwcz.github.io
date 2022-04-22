---
layout: post
author: StevenLwcz
---

### Introduction

In this post we are going to look at a selection of instructions to move data to and from the vector registers in Armv8a and AArch64. For an introduction to NEON SIMD check out [Code In Arm Assembly Lanes and Loads in NEON](https://eclecticlight.co/2021/08/23/code-in-arm-assembly-lanes-and-loads-in-neon).

This post was written with a Cortex-A53 (Raspberry Pi 3B+ 32 bit) and a Cortex-A76 (Acer 513 64 bit). The Raspberry Pi 4 uses a Cortex-A72 and neither Raspberry Pi models support half precision floating point which the Cortex-A76 does.

There are many ways to initialise vector registers in Armv8a and even more in AArch64. Armv8a has `vmov` and `vdup` but AArch64 has `fmov`, `movi`, `orr`, `dup`, `ins`. `smov` and `umov`. Under AArch64 you can use `mov` as an alias for some.

|                                      | Armv8a | AArch64   |
| -------------------------------------|--------------------|
| vector register from integer imm     | vmov   | movi      |
| vector register from float imm       | vmov   | fmov      |
| vector register from vector register | vmov   | mov (orr) |
| vector register from general         | vdup   | dup       |
| vector register from vector element* | vdup   | dup       |
| vector element from vector element   | N/A    | mov (ins) |
| vector element* from general         | vmov   | mov (ins) |
| general from vector element*         | vmov   | smov, mov (umov) |
| scalar from vector element           | N/A    | mov (dup) |

* SIMD Vector Scaler in Armv8a

### Demo Files

This post comes with two demos 
[blog6_32.s](https://github.com/StevenLwcz/gdb-python-blog/blob/main/blog6_32.s) and
[blog6_64.s](https://github.com/StevenLwcz/gdb-python-blog/blob/main/blog6_64.s) which can be build with 
[makefile.blog6](https://github.com/StevenLwcz/gdb-python-blog/blob/main/makefile.blog6). Plus two GDB command files
[blog6_32-gdb.gdb](https://github.com/StevenLwcz/gdb-python-blog/blob/main/blog6_32-gdb.gdb) and
[blog6_64-gdb.gdb](https://github.com/StevenLwcz/gdb-python-blog/blob/main/blog6_64-gdb.gdb).
You also need [vector.py](https://github.com/StevenLwcz/gdb-python/blob/main/vector.py) from the previous post.

```shell
$ make -f makefile.blog6 32
$ gdb -q blog6_32
```
```shell
$ make -f makefile.blog6 64
$ gdb -q blog6_64
```
### Immediate Integer

##### Armv8a
```nasm
    vmov.u8 q0, 1
    vmov.u16 q1, 0x100
    vmov.u32 q2, 0x10000
    vmov.u32 q2, 0x1ff
    vmov.u32 q2, 0x1ffff
    vmov.u64 q3, 0x00ff00ff
```

##### AArch64
```nasm
    movi v0.16b, 1
    movi v2.8h,  1, lsl 8      // 0x100
    movi v4.4s,  1, lsl 24     // 0x1000000
    movi v6.4s,  1, msl 8      // 0x1ff          shift ones
    movi v4.4s,  1, msl 16     // 0x1ffff        shift ones
    movi v6.2d,  0x00ff00ff
```

These instructions have 8 bits allocated to store the immediate value and 4 bits are used for various shifting modes. The 64 bit immediate uses a different scheme. Each bit in the instruction is expanded to 8 bytes: 0b10110110 = 0xff00ffff00ffff00.

For 64 bits if you have a value which repeats every 8, 16 or 32 bits and can be broken down into the immediate form for 8, 16 or 32 then `vmov`/`movi` can be used with a smaller data size to fill the 64 bits. `vmov.u64 q3, 0x11ff11ff11ff11ff` under Armv8 the assembler will convert this to a `vmov.u16 q3, 0x11ff`.
Under AArch64 you would have to code a `movi v3,4s 11, msl 8`.

Other instructions which take an immediate value are `vmvn`/`mvni`. `vorr`/`forr` and `vbic`/`fbic` could be used in combination to boost the range of immediate to 16 bit and some 32 bit values.

### Immediate Float

##### Armv8a

```nasm
    vmov.f32 q4, -2.5
```

##### AArch64

```nasm
    fmov v8.8h, 1.5      // cortex-76
    fmov v10.4s, -2.5
    fmov v12.2d, 3.5
```

`vmov`/`fmov` allows for floating point values which can be expressed with a 3 bit exponent and 4 bit significant (plus 1 bit for the sign). Basically this means any of the floating point values you can generate in this Python script.

```python
for i in range(0,16):
    n = i + 0x10
    s = ""
    for p in range(-7,1):
        s += f'{n * 2**p:<10}'
    print(s)
```

### Vector from Vector

##### Armv8a
```nasm
vmov q5, q2
vmov d12, d8
```

##### AArch64

```nasm
mov v3.16b. v2.16b
mov v9.8b. v8.8b         // move lower 64 bits.
```

Move all 128 bits or 64 bits in one go.

### Vector from General
           
##### Armv8a
```nasm
    mov r0, #10
    vdup.8 q0, r0
    vdup.16 q1, r0
    vdup.32 q2, r0
```
 
##### AArch64
```nasm
    mov x0, 129
    dup v0.16b, w0
    dup v2.8h, w0
    dup v4.4s, w0
    dup v6.2d, x0
```

If you want to load your vector lanes with any value then you can use vdup/dup with a general register. In AArch64 for the targets < 64 bits the source must be a Wn register. 

### Vector from Vector element

NEON SIMD allows you to use C array syntax to specify a cell or element in the vector.  

##### Armv8a

```nasm
    vdup.8 q7, d0[7]
    vdup.16 q8, d1[3]
    vdup.32 q9, d2[1]
    vdup.8 d14, d0[6]
    vdup.16 d16, d1[2]
    vdup.32 d18, d2[0]
```

##### AArch64

```nasm
    dup v1.16b, v0.b[9]
    dup v3.8h, v4.h[4]
    dup v5.4s, v5.s[3]
    dup v7.2d, v7.d[1]
```

### Vector Element from Vector Element

In AArch64 you can move an element from one vector straight to another without changing other parts of the vector.

##### AArch64

```nasm
    ins v0.b[1], v1.b[15]
    ins v2.h[2], v3.h[7]
    ins v4.s[3], v5.s[3]
    ins v6.d[1], v7.d[0]
```

`mov` can be used as an alias for `ins`.

##### Armv8a

To do the same you need to use `vmov` and transfer using a general register.

```nasm
    vmov.u8 r0, d0[5]
    vmov.8 d14[4], r0
    vmov.u16 r0, d1[2]
    vmov.16 d16[3], r0
    vmov r0, d3[1]      // u32 optional
    vmov d18[0], r0     // 32 optional
```

In Armv8a since the scaler floating point registers Sn overlap with the vector you can could use `vmov Sd, Ss` to move 32 bit items around.

### Vector Element from General Register

##### AArch64

```nasm
    movz x0, 0x6666
    ins v0.b[2], x0
    ins v2.h[2], x0
    ins v4.s[2], x0
    ins v8.d[2], x0
```

##### Armv8a

```nasm
    vmov.8  d0[3], r0
    vmov.16 d0[3], r0
    vmov    d0[3], r0   // 32
```

### General Register from Vector Element

Using the signed forms will do signed expansion preseving negative values.

##### AArch64

```nasm
    smov w0, v0.b[7]   // b or h                                                                    │
    smov x1, v0.b[7]   // b, h or s                                                                 │
    umov w2, v0.b[7]   // b, h or s                                                                 │
    umov x3, v6.d[0]   // d  
```
```
(gdb) p /x $x0
$1 = 0xffffffff
(gdb) p $x1
$2 = -1
(gdb) p $x2
$3 = 255
(gdb) p $x3
$4 = -1
```

##### Armv8a

```nasm
    vmov s8 r0, d0[15]
    vmov.u8 r1, d0[15]
```
```
(gdb) p /d $r0
$1 = -1
(gdb) p $r1
$2 = 255
```

### Scalar from Vector Register Element

##### AArch64

```nasm
    dup b2, v0.b[0]
    dup h5, v3.h[3]
    dup s8, v6.s[2]
    dup d11, v9.d[0]
```
In this format all the top bits are set to zero. The `mov` alias can also be used instead.

### Summary

NEON SIMD instructions offer a lot of flexibility in setting up and moving data around in the vector registers. This post gives an overview of these instructions and shows the differenes between Armv8a and AArch64.

AArch64 has more instructions but offers the ability to use `mov` as an alias but not quite the replacement for `vmov`. AArch64 also introduces in the `ins` instruction which allows direct element to element moves for all data sizes.

Instructions which use immediates are quite fiddly since only 8 bits plus various shift modes are avaliable to construct values. Using the OR logical operation can help expand the range before needing to use a literal pool. The immediate forms are also avaliable for a compiler to optimise the assembler code for certain values.

In AArch64 normal instruction mnemonics are often aliases for other instructions to reduce the overall instruction set. The assembler may do other tricks. To see how your assembler may have been transformed you can use the objdump utility.

```shell
$ objdump -d exename -M no-aliases
```

