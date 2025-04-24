---
author: StevenLwcz
layout: post
description: How to use the GDB Python API to create your own TUI windows. This can allow you to add your own extentions to GDB which can help you create custom solutions for your unique debugging scenarios.
---
GDB added a Python API in 7.0 and probably the most used scenario is for pretty printers. In 10.0 they added support for creating TUI (Text User Interface) Windows. This allows us to create new windows, define our own layout and put anything we like in these windows while debugging our program.

- Part 1 of this blog will go over the basics to create a window to display some text.
- Part 2 will add a custom GDB command to allow us to add any text to the window.
- Part 3 will build on all of that to help us create a window to add variables to watch while we step through our program. 
- Part 4 will create an autos window based on `(gdb) info locals`

As we go we will explore the various GDB Python APIs to make all of this happen.

If you are not aware of some common config files which can help make using GDB more productive then please check out [GDB Basic Setup](https://github.com/StevenLwcz/gdb-python/wiki/Gdb-Basic-Setup).

The first thing to do is create a Tui Window to display “Hello World”.

Looking at the GDB Python API for [Implementing new TUI Windows](https://sourceware.org/gdb/onlinedocs/gdb/TUI-Windows-In-Python.html). The 1st thing you need is a class which implements the Tui Window protocol. Here is a template class.

**hellotui.py**

{% highlight python %} 
class HelloWindow(object):

    def __init__(self, tui):
        self.tui = tui
        self.tui.title = "Hello Window"

    def render(self):
        pass

    def close(self):
        pass

    def hscroll(self, num):
        pass

    def vscroll(self, num):
        pass

    def click(self, x, y, button):
        pass
{% endhighlight %}

The class will get passed a tui object which allows us to get hold of properties for the window and write to it. We save that away in our `__init__()` method. This is a good place to set a title. But you can update the title at any time.

The `render()` method is where text is written to the window using the Tui `write(string)` method. We may as well dive in and get fancy and use colour. The docs say *string can contain ANSI terminal escape styling sequences*. 

You can read all about them from this blog [Build your own Command Line with ANSI escape codes](https://www.lihaoyi.com/post/BuildyourownCommandLinewithANSIescapecodes.html). Note the GDB does not support the navigation codes.

Using the 256 colour mode, you can change the colour by changing 47 to something else.
```
GREEN = "\x1b[38;5;47m"
RESET = "\x1b[0m"
```
For some reason to get a new line you need two \n. 
```
NL = "\n\n"
```

My version of GDB has a few bugs which are fixed in a later version.

To put all this together with our “Hello World” text we shall use Python [f-strings](https://saralgyaan.com/posts/f-string-in-python-usage-guide). Our render method now becomes:

```python
    def render(self):
        self.tui.write(f'{GREEN}Hello World{RESET}{NL}')
```

To register the window with GDB we use a GDB global function. The 1st parameter is the name of the window which will be used in GDB Tui commands.

``` gdb.register_window_type("hello", HelloWinFactory) ```

The last parameter is a factory function. This funcrion needs 1 parameter which will be a tui object. We want to pass this object to our HellowWindow class and return the instance of this class back to gdb. GDB will be able to invoke the various methods `render()`, etc as needed.

```python
# Factory Method
def HelloWinFactory(tui):
    return HelloWindow(tui)
```

You can get the complete code from my [git hub repository](https://github.com/StevenLwcz/gdb-python-blog). Now is time to give it a go in GDB.

``` $ gdb -q ```

Read in the python file using the `source` command

``` (gdb) so hellotui.py ```

To use the window we need to create a new layout using the `tui new-layout` command.

``` (gdb) tui new-layout mylayout hello 1 cmd 1 ```

Any new layout must contain the cmd window and the numbers are weights GDB will use to split the windows between the available space.

We can check GDB has registered our layout with `(gdb) layout`.

```
layout asm -- Apply the "asm" layout.
layout mylayout -- Apply the "mylayout" layout.
layout next -- Apply the next TUI layout.  
```

To activate our new layout use `(gdb) layout mylayout` and GDB will go into Tui mode and display our window with the title and “Hello World” text.

![Hello World Window](/images/TuiWindow1.png)

The window height can be changed with:

``` (gdb) winheight hello -10 ```

At this point it might be useful to put our GDB Tui commands in a GDB command text file.

**hello.gdb**
```
source hellotui.py
tui new-layout mylayout hello 1 cmd 1
layout mylayout
```
The `-x` option will read Python scripts or GDB command files. You can put it in a shell script or use the shell command history. 
``` $ gdb -q -x hello.gdb ```


TUI mode can be turned off with:

```(gdb) tui disable```.

GDB removes the window and goes back to command line mode. Any use of `self.tui` in the HelloWindow class will throw an exception (except for `is_valid()`). This is important later when you end up tying your `render()` method to gdb events. To protect ourselves we shall check the `is_valid()` method. 

```python
    def render(self):
        if self.tui.is_valid():
            self.tui.write(f'{GREEN}Hello World{RESET}{NL}')
```

Except it does not work for me. Again I think fixed in a later version of GDB. If GDB goes a bit wobbly because your window threw an exception, `(gdb) layout src` will put it back to normal. And when you quit GDB and discover your shell is not displaying properly. Then:

``` $ stty sane ```

will restore it back to normal. Little things you might experience while developing your Tui Window.

Part 2 will do something more interesting like allow us to add some text to the window using a custom GDB command. Even that might not be so exciting but it is all building blocks for greater things in future posts. To be honest I am really excited about this feature and even feel inspired enough to write some blogs!

