---
layout: post
title: Understanding the StackMapTable Method Attribute
author: StevenLwcz
description: Understanding StackMapTable and the frame types from the JVM Virtual Machine Specification. Concepts and practical examples.
---

### Introduction

If you use the Java disassembler, javap on a class file you will see the StackMapTable attribute on many methods. It is easy to ignore as it does not look relevant to the execution of the method bytecode.

It has an important function however. It is used by the bytecode verification process and since Java 7 it is a mandatory part of any method which requires it. This now means compiler writers and people creating and using libraries for bytecode manipulation need to understand how it works. If you ever see a `java.lang.VerifyError` it is most likely an issue with this attribute.

This post will explain the concepts and build up understanding of StackMapTable to help you understand the JVM Virtual Machine Specification[^1] and help solve your `VerifyError` issues.

### JVM - A Stack Based Virtual Machine

Java bytecode runs on a stack based virtual machine. Instructions like `load` place operands onto the stack. Others like `add` consume operands from the stack, process them and push the result back. `store` instructions pop operands from the stack and place them into fields or local variables.

```java
public class Example1 {
    public void method1(int i, int j) {
        int k = i + j;
        if (k > 20)
            k = 20;
    }
}
```
```bash
$ javac Example1.java
$ javap -l -s -c -verbose -private Example1 > Example1.asm
```
```nasm
  public void method1(int, int);
    Code:
      stack=2, locals=4, args_size=3 
         0: iload_1   
         1: iload_2    
         2: iadd         
         3: istore_3     
         4: iload_3
         5: bipush        20  
         7: if_icmple     13  
        10: bipush        20  
        12: istore_3    
        13: return              
      StackMapTable: number_of_entries = 1
        frame_type = 252 /* append */
          offset_delta = 13
          locals = [ int ]    
```

The stack reaches a depth of 2 (at offset 2), and `args=3` are the parameters *this*, *i* & *j*. 
The method has 4 local variables starting at 0: *this* (Example1), *i*, *j*, & *k*. 

StackMapTable has 1 frame entry. Control flow statements cause StackMapTable entries to be produced. These entries contain frames which describe the stack operands and local variables at certain offsets. 

In the example is 1 frame entry at offset 13 which is after the `if`. It adds another local variable of type integer to the previous frame state.  

The frame belongs to the byte offset at offset_delta. This is added to the previous frame's offset_delta.

Each frame starts with an initial frame state composed of the arguments to the method. Local variable 0 holds *this* and subsequent parameters follow. The initial offset is 0.

```java
          delta_offset = 0
          locals = [ class Example1, int, int]
```

The frames in StackMapTable will build from this initial state.

Here is an annotated version:

```nasm
  public void method1(int, int);
    Code:
      stack=2, locals=4, args_size=3     // local variable 0 = this
         0: iload_1             // local variable 1 = i - one integer on the stack
         1: iload_2             // local variable 2 = j - two integers on the stack
         2: iadd                // one integer on the stack (i + j)
         3: istore_3            // store in local variable 3 - stack now empty
         4: iload_3             // 1 integer on the stack
         5: bipush        20    // two integers on the stack 
         7: if_icmple     13    // two integers removed - control flow causes a stack frame entry 
        10: bipush        20    // one integer on the stack
        12: istore_3            // bytecode verifier will check the stack is correct here before store
        13: return              
      StackMapTable: number_of_entries = 1
        frame_type = 252 /* append */
          offset_delta = 13     // frame for target of if_icmple
          locals = [ int ]      // local variable 3 added to the stack frame
```

### Byte Code Verification

Prior to Java 6 the Java Virtual Machine would verify the stack was correct for all instructions. This is a very intensive process as it would infer the types of local variables and make sure they are correct for the instructions. Compiler bugs or tools which can modify class files, may cause the stack to be in an incorrect state leading to incorrect behaviour. 
In order to ease the process the JVM architects came up with the StackMapTable. This details the expected stack and local state at certain points in the method, namely around control flow. This means the Java bytecode verifier can use this information to check the stack state rather than have to infer it.

Of course this makes compilers and bytecode modifier libraries take up the burden. In the next section we will look into the main concept in StackMapTable, the frame types.

### Frames

As noted previously a method will start with an initial frame comprised on the method parameters.

As more control flow instructions (if, switch, loops, exceptions, etc) are encountered new frames are required. The bytecode verifier needs to know the stack and locals state after branches and when two paths join together (merge points).

In order to optimise how much information is stored for a frame, special frame types are used to express a delta between the previous frame and the new one. If no convenient optimized frame type can be used, then a full frame will be used instead.

There are 7 types of frame entries in the JVM Virtual Machine Specification.

    full_frame
    same_frame
    same_locals_1_stack_item_frame
    same_locals_1_stack_item_frame_extended
    chop_frame
    same_frame_extended
    append_frame

We will briefly show the concepts of each frame type with some examples.

### full_frame

A full frame (tag 255) is generated when the state of locals and stack at a specified offset can't be described efficiently using the more specialized *delta* frame types. This can happen when more than 3 local variables are introduced or a local's type or initialization state changes. 

A full frame describes a delta offset, all the locals at that offset in the method and all stack operands. If either the locals or stack are empty this is indicated by an empty array `[]`.

In the following example *p* is not initialized until the `if` statement. 

#### Example 2

```java
public class Example2 {
    public void method1(int i, int j) {
        int p, q = 0;
        if (i > j)
            p = 20;
        else
            p = 30;
        q += p;
    }
}
```
```nasm
  public void method1(int, int);
    descriptor: (II)V
    flags: (0x0001) ACC_PUBLIC
    Code:
      stack=2, locals=5, args_size=3  // locals [this, int, int]
         0: iconst_0
         1: istore        4
         3: iload_1
         4: iload_2
         5: if_icmple     14                // frame required for offset 14
         8: bipush        20 // if i > j
        10: istore_3
        11: goto          17                // frame required for offset 17
        14: bipush        30 // if i <= j   // append [p, q] p uninitialized
        16: istore_3                        // p is required to be an int
        17: iload         4
        19: iload_3
        20: iadd
        21: istore        4
        23: return
      StackMapTable: number_of_entries = 2
        frame_type = 253 /* append */
          offset_delta = 14
          locals = [ top, int ]             // p, q
        frame_type = 255 /* full_frame */
          offset_delta = 2                                 // offset = 14 + 2 + 1 = 17
          locals = [ class Example2, int, int, int, int ]  // local 3 is integer
                                                           // top must be replaced by int
          stack = []
```

*top* is used if a local is uninitialized or not important to the verifier or the 2nd slot for a long or double. This explains *top* in the frame at offset 14.

At offset 17 at a merge point, the frame tells the verifier local 3 is an integer. As the various frame types are explored, it will become apparent, there are no optimized frame types for this transition *top*->*int* and a full frame must be used.

If you initialized *p*, you could save a few bytecodes!

#### delta_offset

There is an important element about delta_offset which may be missed when working out offsets from the StackMapTable attribute.

In the first frame, the byte offset for the frame is delta_offset. For subsequent frames it is the previous offset + delta_offset + 1. The + 1 ensures no two frames have the same byte offset in the method. Read the specification[^1] for more detail.

#### Example 3
The next example will show a full frame if the number of locals introduced is greater than 3.

```java
public class Example3 {
    public void method1(int i, int j) {
        int p = 0, q = 0, r = 0, s = 0;
        if (i > j)
            p = 20;
        else
            p = 30;
        q += p;
    }
}
```
```nasm
  public void method1(int, int);
    descriptor: (II)V
    flags: (0x0001) ACC_PUBLIC
    Code:
      stack=2, locals=7, args_size=3
         0: iconst_0
         1: istore_3
         2: iconst_0
         3: istore        4
         5: iconst_0
         6: istore        5
         8: iconst_0
         9: istore        6
        11: iload_1
        12: iload_2
        13: if_icmple     22   // new frame for offset 22 required
        16: bipush        20
        18: istore_3
        19: goto          25   // new frame for offset 25 required
        22: bipush        30   // i <= j      - frame 1
        24: istore_3           // end of else 
        25: iload         4    // merge point - frame 2
        27: iload_3
        28: iadd
        29: istore        4
        31: return
      StackMapTable: number_of_entries = 2
        frame_type = 255 /* full_frame */
          offset_delta = 22
          locals = [ class Example3, int, int, int, int, int, int ]
          stack = []
        frame_type = 2 /* same */   // offset 22 + 2 + 1 = 25
```

At offset 25, 4 more local variables are now in scope. There is no optimal frame type for this change
and the full frame format is used.

### same_frame

This frame type (tag 0 - 63) is used as the name implied when the number of local variables are the same as the previous frame. The tag value is the implied delta_offset for the frame. 

```java
        frame_type = 2 /* same */   // delta offset = 2 + 1 (subsequent frame)
```

In the previous example at offset 25 a new frame was introduced. Since the local variables are the same as the previous and importantly there are no stack operands, the same_frame type is used.

### same_locals_1_stack_item_frame

This frame type (tag  64 - 127) is used if the local variables are the same and 1 stack operand is present. The delta offset is the value (frame_type - 64).

```java
public class Example4 {
    public void method1(int i, int j) {
        try {
            i = i + j;
        } catch (ArithmeticException e) {
            System.out.println(e);
        };
    }
}
```
```nasm
  public void method1(int, int);
    descriptor: (II)V
    flags: (0x0001) ACC_PUBLIC
    Code:
      stack=2, locals=4, args_size=3
         0: iload_1
         1: iload_2
         2: iadd
         3: istore_1
         4: goto          15                  // new frame for offset 15 required
         7: astore_3
         8: getstatic     #9                  // Field java/lang/System.out:Ljava/io/PrintStream;
        11: aload_3
        12: invokevirtual #15                 // Method java/io/PrintStream.println:(Ljava/lang/Object;)V
        15: return
      Exception table:
         from    to  target type
             0     4     7   Class java/lang/ArithmeticException
      StackMapTable: number_of_entries = 2
        frame_type = 71 /* same_locals_1_stack_item */
          stack = [ class java/lang/ArithmeticException ]
        frame_type = 7 /* same */
```

The byte offset for frame 1 is 71 - 64 = 7. For frame 2 it is 7 + 7 + 1 = 15.

The Exception table shows that instructions 0-4 could put a ArithmeticException object on the stack and if that happens execution will jump to offset 7 where it is stored in local variable 3. The verifier will check local 3 is correct.

same_frame, means only the number of locals is the same and that the operand stack is empty.

### same_locals_1_stack_item_frame_extended

This frame type has the tag 247 and is the same as same_locals1_stack_item_frame with an explicit delta_offset. This is useful when the offset is greater than 63.

In the previous example, if the try block was large enough, this frame type will come into play.

### chop_frame

This frame has tags 248 - 250, with an explicit delta_offset. It indicates the last 1 - 3 local variables are no longer present (251 - frame_type). In addition there are no stack operands.

Locals used in conditional statements will go out of scope and may need the chop from the frame data!

```java
public class Example5 {
    public void method1(int i, int j) {
	    if (i > 20) {
            float q = 0;
            int p = i;
            if (p > 30)
                p++;
            j = p;
        } 
    }
}
```
```nasm
  public void method1(int, int);
    descriptor: (II)V
    flags: (0x0001) ACC_PUBLIC
    Code:
      stack=2, locals=5, args_size=3   // this, i, j
         0: iload_1
         1: bipush        20
         3: if_icmple     24           // frame for offset 24 required
         6: fconst_0
         7: fstore_3                   // q local 3
         8: iload_1
         9: istore        4            // p local 4
        11: iload         4
        13: bipush        30
        15: if_icmple     21           // frame for offset 21 required
        18: iinc          4, 1         // p++
        21: iload         4            // p <= 30
        23: istore_2                   // locals 3 & 4 go out of scope
        24: return                     // i <= 20
      StackMapTable: number_of_entries = 2
        frame_type = 253 /* append */
          offset_delta = 21
          locals = [ float, int ]
        frame_type = 249 /* chop */    // 251 - 249 = 2 locals to remove
          offset_delta = 2             // offset 24 = 21 + 2 + 1 (frame_type)
```

Here two local items go out of scope at offset 24 and can be dropped from the frame data. The compiler will also be free to reuse local 3 and 4 if required later in the method.

### same_frame_extended

This has tag 251. This is the same as same_frame with an explicit delta offset for when the offset > 63.

### append_frame

This frame has tag 252 - 254 and is used to append 1 - 3 local variables to the frame (frame_type - 251). An explicit offset_delta is also specified.

From the examples in this post, it is the most commonly used. From Example 5:

```java
      StackMapTable: number_of_entries = 2
        frame_type = 253 /* append */        // 253 - 251 = 2 locals to add
          offset_delta = 21
          locals = [ float, int ]
```

If more than 3 local variables are added then a full frame is required. 

### Frame Tags 128 - 246

These tags are reserved for future use. Just in case you noticed the gap.

### Verification Errors

This post would not be complete if it did not highlight a verification error. Going back to our first example:

```java
      StackMapTable: number_of_entries = 1
        frame_type = 252 /* append */
          offset_delta = 13
          locals = [ int ]      // local variable 3
```

And looking this up in the JVM Virtual Machine Specification[^1].

```java
append_frame {
    u1 frame_type = APPEND; /* 252-254 */
    u2 offset_delta;
    verification_type_info locals[frame_type - 251];
}

Integer_variable_info {
    u1 tag = ITEM_Integer; /* 1 */
}
```

This frame adds one new local of the specified type integer. Working out the byte sequence we have `fc 00 0d 01`. Looking at a hex dump of the class file, we find it here:

```
000110: 00 06 00 0d 00 07 00 0d 00 00 00 06 00 0>fc 00 
000120: 0d 01<00 01 00 0e 00 00 00 02 00 0f
```

Lets change that type to something else, say a float:

```java
Float_variable_info {
    u1 tag = ITEM_Float; /* 2 */
}
```
```
000120: 0d>𝟎𝟐<00 01 00 0e 00 00 00 02 00 0f
```
```bash
$ xxd Example1.class > Example1.hex
$ vi Example1.hex
$ xxd -r Example1.hex > Example1.class
```
```bash
# One modified class file later
$ java Example1
```
```
Error: Unable to initialize main class Example1
Caused by: java.lang.VerifyError: Inconsistent stackmap frames at branch target 13
Exception Details:
  Location:
    Example1.method1(II)V @13: return
  Reason:
    Type integer (current frame, locals[3]) is not assignable to float (stack map, locals[3])
  Current Frame:
    bci: @7
    flags: { }
    locals: { 'Example1', integer, integer, integer }
    stack: { integer, integer }
  Stackmap Frame:
    bci: @13
    flags: { }
    locals: { 'Example1', integer, integer, float }
    stack: { }
  Bytecode:
    0000000: 1b1c 603e 1d10 14a4 0006 1014 3eb1     // istore_3, return
  Stackmap Table:
    append_frame(@13,Float)
```

The bytecode verifier threw our class out right at the start. The current frame shows an integer for local variable 3 and the stackmap frame (from the attribute) says it should be a float. That does not match and it is not happy.

This is only one possible type of error, but now if you encounter one, it should be easier to identify what the underlying issue is.

### Conclusion

Given the amount of posts on StackOverflow[^2] this is a topic which a lot of people have to deal with in some respect in their projects.

This post has used practical examples to explain the concepts around StackMapTable and the various frame types. Now reading javap's output and the JVM Virtual Machine Specification should be much more straight forward, as well as help you in your compiler and bytecode manipulation projects.

Now you will combat these `VerifyErrors` with ease!

### References

[^1]: [Java Virtual Machine Specification - StackMapAttribute](https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-4.html#jvms-4.7.4)
[^2]: [Articles about StackMapTable on StackOverflow](https://stackoverflow.com/search?q=StackMapTable)
