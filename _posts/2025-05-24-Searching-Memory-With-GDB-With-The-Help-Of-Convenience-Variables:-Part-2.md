---
layout: post
author: StevenLwcz
description: Searching Memory in GDB. Creating Conveniance Variables in GDB. GDB Python API.
---

Searching Memory in GDB With the Help of Convenience Variables - Part 2

### Introduction

In the previous post we explored using `find` in various scenarios. In this post we will streamline using `find` for some memory regions like .rodata, .text and .data. We will use GDB view of the memory and turn it into some handy to use convenience variables, all using Python and GDB Python API.

### maint info sections

This GDB command is similar to `info file` but the list is limited to the program being debugged.

```
(gdb) maint info section
# edited output

 [12]     0x5555550740->0x55555508e0 at 0x00000740: .text ALLOC LOAD READONLY CODE HAS_CONTENTS
 [14]     0x55555508f4->0x55555508f8 at 0x000008f4: .rodata ALLOC LOAD READONLY DATA HAS_CONTENTS
 [22]     0x5555570040->0x55555700c0 at 0x00010040: .data ALLOC LOAD DATA HAS_CONTENTS
 [23]     0x55555700c0->0x55555700c8 at 0x000100c0: .bss ALLOC
```

It has a filter argument where you can specify specific sections

```
(gdb) maint info section .rodata .text .data .bss
```

Which will produce the edited output above.

In Python we can run this command and return the output into a string.

```
output = gdb.execute("maint info sections .text .rodata .data .bss")
print(output)
# same as above
```

### Creating A Regular Expression

From the output of `maint info sections` we want to collect the start and end addresses of the four regions.

Python has a powerful modern regex syntax. We will use named captures `(?P{<name>regex)`. The advantage over the index based version is more readability and flexibility in constructing the regex. You don't have to update indexes as you develop it. It also makes the code which processes the results more readable [^1].

```python
import re

pattern = re.compile(r'(?P<first>0x[0-9a-f]{10})->(?P<second>0x[0-9a-f]{10}).*(?P<region>\.text|\.rodata|\.data|\.bss)')
```

Let's break this down:

```
(?P<first>0x[0-9a-f]{10})
```

`?P` creates a named capturing group called `first`. The rest captures 10 hex digits starting with `0x`.

```
(?P<region>\.text|\.rodata|\.data|\.bss)
```

This means the regex will only match these data section and we only capture the addresses for them.

See The Python Docs for more info on Python Regular expressions [^1]..


### Processing the Matches

Here we capture all the matched addresses with the region they belong to and store in a dictionary.
The key is the region and the value is a tuple for the start and end address.

```python

i = pattern.finditer(output)

regions = {}
for m in i:
    s = m.group('first')
    e = m.group('second')
    r = m.group('region')
    print(f"{s} {e} {r}")
    regions[r] = (s, e)
```

Learn more about Python Regular Expressions and `finditer`[^4].

### Creating Convenience Variables

We are going to create the following list of convenience variables which we will be able to use with `find`.

    $data_start
    $data_end
    $text_start
    $text_end
    $ro_start
    $ro_end

In the GDB Python API we can read and create convenience variables with:

```Python
gdb.convenience_variable(name)
gdb.set_convenience_variable
```

```
(gdb) python
gdb.set_convenience_variable("testvar", 34567)
print(gdb.convenience_variable("testvar")"
end
>>>>
(gdb)print $testvar
34567
```

### Creating Our Script

Here we simply create our desired convenience variables from the regions dictionary.
The only little trick we do here is merge data and bss into one area since they are contigous in memory.

...python
gdb.set_convenience_variable("text_start", int(regions[".text"][0], 16))
gdb.set_convenience_variable("text_end", int(regions[".text"][1], 16))
     
gdb.set_convenience_variable("ro_start", int(regions[".rodata"][0], 16))
gdb.set_convenience_variable("ro_end", int(regions[".rodata"][1], 16))

gdb.set_convenience_variable("data_start", int(regions[".data"][0], 16))
gdb.set_convenience_variable("data_end", int(regions[".bss"][1], 16))
```

Lets run the script and use the GDB command to display all convenience variables to see the result.

```
so conv.py
show conv

$data_end = 366503985264
$data_start = 366503985216
$ro_end = 366503856659
$ro_start = 366503856640
$text_end = 366503856620
$text_start = 366503855936
```

Now we can start using them with other GDB commands.

...
(gdb) printf "%x, %x", $data_start, $data_end
(gdb) find $data_start, $data_end, {char[5]}"abcde"
(gdb) find $text_start, $text_end, 0xkkkkkkk   # some instruction 
```

### The Last Trick

I prefer to see my addresses in hex. It is how GDB presents them and many crash dumps, and stack traces also present them. Here we will use some GDB Python API manipulation to make our convenience variables display in hex, like you would if you printed one in GDB.

```
(gdb) print(s2)
x7ff7cff010 'x' <repeats 200 times>..
```

Lets convert our convenience variables into `char *` and look more into some GDB Python API.

First we need to create the GDB type of `char *`. This is done by using `lookup_type()` the parameter being the text of the type. This type can be converted into other types, in this case `pointer()` [^2].

```Python
type_ptr_char = gdb.lookup_type("char").pointer()

```

`gdb.Value()` will create a GDB type from a Python item. Then we can like we can with C casts, cast the int to a `char *`[^3].

```Python
def create_ptr(addr):
    return gdb.Value(int(addr, 16)).cast(type_ptr_char)
```

Lets update our Python script.

```Python
gdb.set_convenience_variable("text_start", create_ptr(regions[".text"][0]))
gdb.set_convenience_variable("text_end", create_ptr(regions[".text"][1]))
     
gdb.set_convenience_variable("ro_start", create_ptr(regions[".rodata"][0]) + 8)
gdb.set_convenience_variable("ro_end", create_ptr(regions[".rodata"][1]))

gdb.set_convenience_variable("data_start", create_ptr(regions[".data"][0]))
gdb.set_convenience_variable("data_end", create_ptr(regions[".bss"][1]))

```

When we run this new script in GDB and `show conv`:

```
data_end = 0x55555700c8 ""
$data_start = 0x5555570040 ""
$ro_end = 0x55555508f8 "\001\033\003;D"
$ro_start = 0x55555508fc "D"
$text_end = 0x55555508e0 <_fini> "\037 \003\325\375{\277\251\375\003"
$text_start = 0x5555550740 <_start> "\037 \003\325\035"
```

Is it better? Hex values are nice from my pov. And learning to manipulate types could be handy in future.

### Conclusion

In this post we have looked at 'maint info sections` and how it differs from `info file`. with some benifits like filtering by region. 
we learned how to use capture group regex to collect information we are interested in.
Finally We have looked at how to create conveniance variables using the GDB Python API from our collected info to create coneniance variables tailored to our specific needs.

As we saw in the previous post convenience variables are useful for writing svripts in GDB and now we can create them via the Python GDB API on more complex data.

### References

[^1]: [Python Regular Expressions](https://docs.python.org/3/library/re.html)
[^2]: [Types in GDB](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Types-In-Python.html#Types-In-Python)
[^3]: [Values in GDB](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Values-From-Inferior.html)
[^4]: [Python Tutorial: re Module](https://www.youtube.com/watch?v=K8L6KVGG-7o)
