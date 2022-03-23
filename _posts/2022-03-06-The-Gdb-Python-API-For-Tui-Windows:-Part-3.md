---
author: StevenLwcz
layout: post
---
In this post we will learn how to read variables using the Python API and hook our Tui Window up to a GDB event and use them to implement a watch window.

GDB already has many ways to print variables and several methods to print them automatically to the cmd window. See [Printing Variables in GDB]({{ site.github_url }}gdb-python/wiki/Printing-Variables-in-GDB). A watch window approach can free up some space in the cmd window and help us focus on variables which we are most interested in.

Building on the framework from the last post, we will start with this skeleton which defines our new GDB command `(gdb) watch` and a Tui window to place the variables. `(gdb) watch` will take the arguments and turn them into a list to pass to the WatchWindow object.

**watchwin-basic.py**

```python
GREEN = "\x1b[38;5;47m"
BLUE  = "\x1b[38;5;14m"
WHITE = "\x1b[38;5;15m"
GREY  = "\x1b[38;5;246m"
RESET = "\x1b[0m"
NL = "\n\n"

class WatchCmd(gdb.Command):
    """Add variables to the TUI Window watch
watch variable-list
Variables will be greyed out when it goes out of scope.
Changes to the values while stepping are highlighted in blue."""

    def __init__(self):
       super(WatchCmd, self).__init__("watch", gdb.COMMAND_DATA)
       self.window = None

    def set_window(self, window):
        self.window = window

    def invoke(self, arguments, from_tty):
        if self.window:
            argv = gdb.string_to_argv(arguments)
            self.window.set_watch_list(argv)
            self.window.render()
        else:
            print("watch: Tui Window not active yet")
            return

watchCmd = WatchCmd()

def WatchWinFactory(tui):
    win = WatchWindow(tui)
    watchCmd.set_window(win)
    return win

class WatchWindow(object):

    def __init__(self, tui):
        self.tui = tui

    def set_watch_list(self, list):
        self.watch_list = list

    def close(self):
        pass

    def render(self):
        if not self.tui.is_valid():
            return

gdb.register_window_type("watch", WatchWinFactory)
```

The 1st new thing in the `invoke()` method is some protection if the Tui mode has not been activated yet.

To read the values of variables using the Python API, from the [Frames In Python](https://sourceware.org/gdb/onlinedocs/gdb/Frames-In-Python.html) docs, there is a `read_var()` method from a frame object. To get a frame object we use `gdb.selected_frame()`. This returns the current frame `(gdb) info frame`, which changes as we step through a program.

We can add this to our `render()` method.

```python
        self.tui.erase()

        frame = gdb.selected_frame()
        for name in self.watch_list:
            val = frame.read_var(name)
            self.tui.write(f'{GREEN}{name:<10}{RESET}{val}{NL}')
```

Care is needed however. Before the program has run or after execution has finished there will be no frame and Python will throw a: 

```
Python Exception <class 'gdb.error'> No frame is currently selected.:
```

We can simply catch this exception and return back to GDB.

```python
        try:
            frame = gdb.selected_frame()
        except gdb.error:
            self.tui.write("No frame currently selected" + NL)
            return
```
The frame object has a method `name` for the current frame, which we can use to set the window title.

```python
       self.tui.title = frame.name()
```
For this blog I have a small C program [circle1.c](https://github.com/StevenLwcz/gdb-python-blog/blob/main/circle1.c) which you can download and compile.

```shell
$ gcc -o circle -g circle.c
```
GDB can auto load GDB command files in the format of myapp-gdb.gdb. We will put our `tui` and `layout` commands in there. Note you need to make sure autoload is set in your `$HOME/.gdbinit` file. See [GDB Basic Setup](https://github.com/StevenLwcz/gdb-python/wiki/Gdb-Basic-Setup) for more info.

**circle1-gdb.gdb**
```
b main
run
so watchwin-basic.py
tui new-layout debug1 watch 1 src 1 status 0 cmd 1
layout debug1
```
``shell
$ gdb -q ./circle1
```
```
(gdb) watch s1 s2 buff p1 area length
```
![](/images/TuiWindow3.png)

Great! We are done. Well not quite, there is still some work to be done to improve this.

1. The values don’t update when they are changed when we step through the program.
1. If the variable goes out of scope we get a gdb.error exception.
1. It would be nice if the variable was highlighted in some way when the value changed.
1. Variables are lost when the layout is changed.

To solve the 1st problem we need to hook our `render()` method to a suitable GDB event. Looking at 
[Events In Python](https://sourceware.org/gdb/onlinedocs/gdb/Events-In-Python.html) we see `events.before_prompt`.

```
This event carries no payload. It is emitted each time GDB presents a prompt to the user.
```

In our factory function we will use the `connect()` method to register our `rendor()` method.

```python
def WatchWinFactory(tui):
    ...
    # register render() to be called each time the gdb prompt will be displayed
    gdb.events.before_prompt.connect(win.render)
    return win
```

Now we can remove the `render()` line from the WatchCmd `invoke()` function.

To stop the `render()` method being called when the window has been closed due to a change of layout we need to use the `disconnect()` method in the WatchWindow `close()` method.

```python
   def close(self):
        … 
        # stop rendor() being called when the window has been closed
        gdb.events.before_prompt.disconnect(self.render)
```

Finally as we step through the program the values will be updated.

The next obvious problem is when the variable goes out of scope, Python will throw a

```
(gdb) Python Exception <class 'ValueError'> Variable 's1' not found
```

One way to solve this problem is to simply catch the `gdb.ValueError`. We will grey out the variable and when it comes back into scope again it will be restored.

```python
            try:
                val = frame.read_var(name)
                self.tui.write(f'{GREEN}{name:<10}{RESET}{val}{NL}')
            except ValueError:
                self.tui.write(f'{GREY}{name:<10}{NL}')
```

To highlight a change in a variable's value, we can store the values in a dictionary to compare the next time `render()` is called. Lets add a dictionary to the `__init__()` method for WatchWindow.


```python
    def __init__(self, tui):
        … 
        self.prev = {}
```

And code to check the dictionary and store the current value.

```python
                if name in self.prev and self.prev[name] != val:
                    hint = BLUE
                else:
                    hint = WHITE

                self.prev[name] = val
                self.tui.write(f'{GREEN}{name:<10}{hint}{val}{RESET}{NL}')
```

Now the values get highlighted when they change as we step through the program.

I suppose you could use the cached value to display alongside any greyed out variable. I shall leave that as an exercise to the reader.

The last problem. if you change the layout and back again

```
(gdb) layout src
(gdb) layout debug1
```

then the window gets reset. To solve this we can save the watch list away in the `close()` method and restore in the `__init__()` method.

```python
class WatchWindow(object):

    save_list = []

    def __init__(self, tui):
        … 
        self.watch_list = WatchWindow.save_list

    def close(self):
        … 
        # save the watch list so it will be restored when the window is activated
        WatchWindow.save_list = self.watch_list
```

Now when we switch layouts the list of variables is restored. Download [watchwin-basic.py](https://github.com/StevenLwcz/gdb-python-blog/blob/main/watchwin-basic.py) for the complete program.
 
Lets step through the C program a little more adding variables which are initially out of scope.
```
(gdb) watch s1 s2 buff p1 area length len len1
```
As you step through the C program into the `if` blocks in `main()` you will notice the variables defined in `main()` don't grey out. The frame `read_var()` method reads variables from its own block and then traverses its parent to the top including the static and global blocks. So you can even watch static and global items.

```
(gdb) watch s1 s2 buff p1 area length len len1 circle1 circle2
```
 
There is a whole bunch more we could do with this little Tui window. Some ideas:

1. Add the type of the data item. 
1. Identify if the variable is static or global. 
1. Improve the gdb command to error if the symbol does not exist in the program. 
1. Be able to add more variables, delete them or clear the list.
1. Display variables in hex.. 
1. Allow window scrolling to work.

Looking at a few more Python APIs will solve some of the problems, along with some simple Python programming, which we shall look at in a future blog.
