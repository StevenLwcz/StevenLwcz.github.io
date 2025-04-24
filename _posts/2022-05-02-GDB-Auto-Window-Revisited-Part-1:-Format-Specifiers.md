---
layout: post
author: StevenLwcz
description: Enhancing the TUI Auto Window using the GDB Python API. The Auto Window provides similar features in GDB you can find in IDEs.
---

In this post we are going to go back to the Auto Window from [Tui Windows Part 4](https://stevenlwcz.github.io/2022/03/13/The-Gdb-Python-API-For-Tui-Windows-Part-4.html) and add the ability to set a format specifier for any variable being shown in the Auto Window.

In GDB you can print any variable with a format specifier with the `print` command.

```
(gdb) p /z argc     # print argc in hex
```

To see all the format specifiers `(gdb) help x`.

```
Format letters are o(octal), x(hex), d(decimal), u(unsigned decimal),
  t(binary), f(float), a(address), i(instruction), c(char), s(string)
  and z(hex, zero padded on the left).
```

In Python values for variables are held in [gdb.Value](https://sourceware.org/gdb/onlinedocs/gdb/Values-From-Inferior.html) objects and can be converted to strings with the `format_string()` method. This method has a key argument `format` which allows you to specify the exact same specifiers as for the `print` command.

In the `create_auto()` method of [autowin.py](https://github.com/StevenLwcz/gdb-python-blog/blob/main/auto-win.py) we can add logic to check if there is a specifier then use that. We will store the format specifier in a dictionary with the variable as a key.

```python
                if name in self.format:
                    val = val.format_string(format=self.format[name])

                self.list.append(f'{arg}{line:<6}{YELLOW}{type:<16}{GREEN}{name:<10}{hint}{val}{RESET}{NL}')
```

We shall create a custom GDB command `auto` to allow us to specify a format and a variable list and add it to the dictionary. Additional logic is required to check the command line is correct and the format specifier is valid.

It is also a good idea to validate the variable name. Looking at [Symbols in Python](https://sourceware.org/gdb/onlinedocs/gdb/Symbols-In-Python.html) this can be done by using 
`gdb.lookup_symbol()` to check if the variable is in the current frame. Since this method will also find typedefs and other things we need to check it is a variable using `is_variable` and `is_argument` properties. The method returns a tuple but we are only interested in the 1st which is the Symbol object or `None` if it does not exist.


```python
    def set_format(self, argv):
        fmt = argv[0][1:2]
        del argv[0]
        for name in argv:
            symbol = gdb.lookup_symbol(name)[0]
            if symbol and (symbol.is_variable or symbol.is_argument):
                self.format[name] = fmt
            else:
                print(f'auto: {name} is not a variable or argument.')
                return
```

In order to reset the specifier the `auto` command allows you to specify variables without a format and it will use a method called `clear_format()` to remove the item from the format dictionary.

There is a new version [auto.py](https://github.com/StevenLwcz/gdb-python-blog/blob/dev/auto.py) in my git repository and using the same C program from Part 4. Just update the circle-gdb.gdb file to read auto.py.

```
gdb -q circle1
auto /z argc
auto /t s1
auto /c buff1
auto /a p1
```
![Auto Wimdow](/images/TuiWindow7.png)

To remove all the specifiers:

```
(gdb) auto argc s1 buff1 p1
```

F-Strings in Python are highly versatile and offer a lot of formatting options but they do not work well with `gdb.Value` objects because they don’t implement the `__format__()` method and if you try it you can get: `TypeError: unsupported format string passed to gdb.Value.__format__`.  

You can convert the `gdb.Value` object to a Python object but this starts to get messy.
Since we want the Auto WIndow to reflect similar functionality as `print` `format_string()` works out fine and the string object can then be used in any F-String with padding if desired.

In Part 2 we will continue to work on the Auto Window and add horizontal scrolling which will also provide a framework which can work for any other Tui Window Python program.
