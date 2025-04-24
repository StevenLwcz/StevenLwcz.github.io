---
layout: post
author: StevenLwcz
description: Adding vertical scrolling to a TUI Window in GDB using the Python API.
---

[The GDB Python API for Tui Windows Part 4](https://stevenlwcz.github.io/2022/03/13/The-Gdb-Python-API-For-Tui-Windows-Part-4.html) showed how to add vertical scrolling to Tui Windows we create. In this post we will look at adding horizontal scrolling.

Horizontal scrolling on TUI Windows is useful if the line will exceed the right column. This is most likely with source lines and of course long values for variables. Horizontal scrolling is available on most Tui Windows. You can display the list of windows with `(gdb) info win`.

```
(gdb) info win
Name       Lines Focus
regs          15
src           16 (has focus)
status         1
cmd           16
```

Select a window: `(gb) focus src` and use the left and right cursor keys to scroll left and right. Notice GDB allows you to scroll right forever. You can’t scroll the status or cmd windows and in my version of GDB scrolling of the regs window is broken.

If you scroll in the src window you will notice the line column stays fixed but in the asm window the whole line is scrolled. We will look at how to achieve different horizontal scrolling effects in this post.

The [TUI Window protocol](https://sourceware.org/gdb/onlinedocs/gdb/TUI-Windows-In-Python.html) has a `hscroll()` method and we will use this to update `self.horiz` in a similar vein for vertical scrolling.

```
    def hscroll(self, num):
        if num > 0 or num < 0 and num + self.horiz >= 0:
            self.horiz += num
            self.render()
```

Since it will take some additional logic to know what the max line length is in `self.list` we will take the same approach as GDB and not have a restriction on scrolling to the right.


Now it is simply a matter of applying  `self.horiz` in the `render()` method to split the string at the appropriate offset.

```python
            for l in self.list[self.start:]:
                self.tui.write(l[self.horiz:])
```

If we were dealing with plain text then the job is done. However we are using ANSI escape sequences to colour various parts of the line and this simple approach will lead to the ANSI escape sequences being corrupted.

We could solve this in many ways and any approach I have thought about means adding logic to the `render()` method to know something about the structure of the contents it is displaying.

This just adds more complexity to the method and I prefer the approach that `render()` is agnostic to the contents it displays. We explore a more generic approach which can work with any custom TUI window.

To achieve horizontal scrolling we simply want to display the string from an offset but not split any escape sequence in two. And if we scan the string to skip any escape sequence we still want to display one or we end up with a missing colour. What we want then is a substring function which will return a string with the last escape sequence found up to `self.horiz` and append to it, the rest of the string.

```python
def substr_end_with_ansi(start_off, st):
    """return the end of the string starting from start_off
       will always return the end of line characters"""

    seq = ""
    esc = False
    count = 0
    for i, c in enumerate(st):
        if esc:
            seq += c
            count += 1
            if c == 'm':
               esc = False
        else:
            if i - count >= start_off:
                break

            if c == '\x1b':
                esc = True
                seq = '\x1b'
                count += 1
            elif c == '\n':
                break

    return(seq + st[i:])
```

We are going to take a simple approach to detecting the ANSI escape sequence, which always starts with `0x1b` and end with an `m`. A more rigorous one might be to use a regular expression which also includes checking the contents.

Another complication is if the horizontal offset goes beyond the end of the string, we return an empty string. The contents of the Tui Window will become messed up because the `write()` method relies on the end of line characters to position the text in the window. So we make sure we return the end of line characters.

With all that, we just need to add the function to the [auto.py](https://github.com/StevenLwcz/gdb-python-blog/blob/dev/auto.py) and change the `render()` method:

```python
        if self.horiz == 0:
            for l in self.list[self.start:]:
                self.tui.write(l)
        else:
            for l in self.list[self.start:]:
                self.tui.write(substr_end_with_ansi(self.horiz, l))
```
Now we can scroll the whole of the auto window left and right (as well as up and down).

Just say we want to keep a portion fixed, say the line numbers or the types or the names and just scroll the variables to the left. For this we need another substring method which will return the beginning portion of a string up to the offset we are interested in.

```python

def substr_start_with_ansi(end_off, st):
    """return the beginning of the string ending at end_off"""

    esc = False
    count = 0
    for i, c in enumerate(st):
        if esc:
            count += 1
            if c == 'm':
               esc = False
        else:
            if i - count >= end_off:
                break

            if c == '\x1b':
                esc = True
                count += 1

    return(st[0:i])
```

In order not to populate our code with magic numbers, we will define some constants.

```python
class AutoWindow(object):

    # see the padding values used in the F-String in create_auto()
    TypeOffset = 7
    NameOffset = TypeOffset + 16
    ValueOffset = NameOffset + 10
    ValueOffsetm2 = NameOffset + 8
```

Now we can construct our string with a fixed portion by using the two methods in combination which we will put in a new method in the AutoWindow class.

```
# scroll horizontally keeping the text to end_off static
    def scroll_auto_line_1(self, end_off, st):
        return substr_start_with_ansi(end_off, st) + substr_end_with_ansi(end_off + self.horiz, st)
```

```python
    def render():
    ...
            for l in self.list[self.start:]:
                self.tui.write(self.scroll_auto_line_1(AutoWindow.TypeOffset, l))
```

You can change the 1st parameter to control which part of the output stays fixed while scrolling the rest.

Just for fun, one effect we might like is to simply make the type and variable names disappear at the first few presses of the left cursor key.

Depending on the value of `self.horiz` we can use the two substring methods with the appropriate offsets to achieve this.

```python
# scroll horizontally keep the line numbers visible
# horiz = 1: make the type names disappear
# horiz = 2: make the variable names disappear
# horiz > 2: scroll the value 
    def scroll_auto_line_2(self, st):
        if self.horiz == 1:
            return substr_start_with_ansi(AutoWindow.TypeOffset, st) + substr_end_with_ansi(AutoWindow.NameOffset, st)
        else:
            return substr_start_with_ansi(AutoWindow.TypeOffset, st) + substr_end_with_ansi(AutoWindow.ValueOffsetm2 + self.horiz, st)

```

```python
    def render():
    ...
            for l in self.list[self.start:]:
                 self.tui.write(self.scroll_auto_line_2(l))
```
See [auto.py](https://github.com/StevenLwcz/gdb-python-blog/blob/dev/auto.py) for the full code and `render()` has various lines commented out for the different scrolling effects we have explored.

In the end we have introduced knowledge about the layout of the contents in the `render()` method, but in a very adaptable way. But then we have chosen to define the horizontal scroll behaviour based on the known columns of the data.

Just as a thought, if there is a desire to be able to change the scroll effect during debugging, we could add an option to the `auto` command to change between horizontal scroll effects. 

```
auto /NUM
 0: Normal horizontal scrolling
 1: Line column fixed
 2: Scroll values only
 3: Quick scroll method
```

Anyway, now we have achieved a framework for horizontal scrolling which we can use in our TUI window projects.

