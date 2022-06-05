---
layout: post
author: StevenLwcz
---

In this post we will go back to the Watch Window created in [Part 3](https://stevenlwcz.github.io/2022/03/06/The-Gdb-Python-API-For-Tui-Windows-Part-3.html). I’ve added the features listed at the end of that post. Some of these features were also added to the Auto Window so we won’t talk about them here.

The new [watchwin.py](https://github.com/StevenLwcz/gdb-python-blog/blob/dev/watchwin.py) has been enhanced to have the following:

- The command changed from watch to watchwin (abbr watchw) to avoid conflict with GDB’s watch command
- watchw /FMT variable-list to add a format specifier
- Check the variable being added exists in the current frame
- Shows the type which can be toggled on or off
- Add additional variables, delete specific ones or clear the whole window.
- Adds a marker to indicate global, static or argument
- Horizontal scrolling

```
(gdb) help watchw
watchwin variable-list
    Add variables in the current frame to the TUI Window watch.
    Variables will be greyed out when they go out of scope.
    Changes to values while stepping are highlighted in blue.
watchwin /FMT  variable-list
    Set the format specifier as per print /FMT for the variable list
watchwin /C variable-list
    Clear the format specifier for the variable list
watchwin del variable-list
    Delete variables from the watch window.
watchwin clear
    Clears all variables from the watch window.
watchwin type [on|off]
    Toggle display of the variable type and indicator: static(=), global(^) or argument(*).

```

### User Validation, Static and Global

[Symbols in GDB](https://sourceware.org/gdb/onlinedocs/gdb/Symbols-In-Python.html)

GDB’s symbol tables not only have variables but also enums, typedefs, function names and so on. Adding these to the Watch Window will cause problems for `read_var()`. If the symbol is found we can use `is_variable` and `is_argument attributes` to test if it is a variable and give an error if not. If the item is not found in the symbol table for the current frame then we just simply give a *not found in current frame* error.

There is no attribute for static or global items so the best way to find out if the item is one or the other is to use the respective `lookup_global_symbol()` and `lookup_static_symbol()` methods. If it is not found from one of these we can use `lookup_symbol()` which only finds variables in the current frame.

```python
    def add_watch(self, list, fmt=None):
        for name in list:
            symbol = gdb.lookup_global_symbol(name)
            if symbol and symbol.is_variable:
                tag = "^"
            else:
                symbol = gdb.lookup_static_symbol(name)
                if symbol and symbol.is_variable:
                    tag = "="
                else:
                    symbol = gdb.lookup_symbol(name)[0]
                    if symbol:
                        if symbol.is_argument:
                            tag = "*"
                        elif symbol.is_variable:
                            tag = " "
                        else:
                            print(f'watchwin: {name} is not a variable or argument.')
                            return
                    else:
                        print(f'watchwin: {name} not found in current frame.')
                        return

            self.watch[name] = {'tag': tag, 'type': str(symbol.type), 'fmt': fmt, 'val': None}

```

There is no API to check if a variable exists across the whole program, so only variables valid for the current frame can be added. When they go out of scope they are greyed out in `create_watch()`. There is nothing stopping us adding variables out of scope per say to the internal dictionary but if you add something which is not a variable you would have to then manually remove it from the window at some point. Doing user validation in the long run is the best approach.

### Watchw in GDB Command Files

If you wanted to set up your `watchw` commands in a GDB file then one method is to set temp breakpoints for when the variable comes into scope and execute the `watchw` command by defining a `(gdb) command` for the breakpoint. `(gdb) command` has an argument which is the breakpoint number but quite conveniently when specified without it uses the number of breakpoint last set. The `silent` command turns off notification that a breakpoint has been hit.

**circle1-gdb.gdb**
```
tb 50
command
silent
watchw a
end
so ../gdb-python-blog/watchwin.py
tui new-layout debug1 watch 1 src 2 status 0 cmd 1
layout debug1
b main
watchw length area
```

Since the temp breakpoints don’t execute the command until the line has been reached the command can be set up even before the custom GDB command has been registered. I pretty much always have a breakpoint at `main` so we can just use a straight forward `watchw` command after `b main`.
 
An enhancement for `watchw`  would be to dump the current watch window in GDB command file format and create all the temp breakpoints and commands to set up the window again. Since the Symbol object contains the line the variable is defined then this should be very feasible. The `(gdb) source` command can be used to read the file back in again.

