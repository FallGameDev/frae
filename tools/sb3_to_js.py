#!/usr/bin/env python3
"""
sb3_to_js.py
Turns the scripts inside a Scratch 3 project.json into readable JavaScript.

Every Scratch script becomes a JavaScript "generator function" (function*).
Generators can pause with `yield`, which is how we copy Scratch's behavior:
  - loops pause once per pass (so the screen can redraw)
  - "wait" blocks pause until the time is up
The game runtime (engine.js section of the game page) steps these generators
30 times a second, just like Scratch does.

Usage:  python3 sb3_to_js.py project.json  > scripts.js
"""
import json, re, sys

# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
IDENT = re.compile(r'^[A-Za-z_$][A-Za-z0-9_$]*$')

def js_str(s):
    """Quote a Python string as a JavaScript string literal."""
    return json.dumps(str(s), ensure_ascii=False)

def prop(obj, name):
    """obj.name if name is a safe identifier, else obj["name"]."""
    return f'{obj}.{name}' if IDENT.match(name) else f'{obj}[{js_str(name)}]'

def is_num_literal(s):
    """True if a text value looks like a plain number (so we can write it without quotes)."""
    return isinstance(s, (int, float)) or bool(re.fullmatch(r'-?(\d+\.?\d*|\.\d+)', str(s).strip())) and str(s).strip() == str(s)

def num_literal(s):
    v = float(s)
    return str(int(v)) if v.is_integer() and 'e' not in str(s).lower() else repr(v)


class Converter:
    def __init__(self, project):
        self.p = project
        self.stage = next(t for t in project['targets'] if t['isStage'])
        self.global_vars = {vid: v[0] for vid, v in self.stage['variables'].items()}

    # -----------------------------------------------------------------------
    # Variables: work out a readable name for each variable id
    # -----------------------------------------------------------------------
    def var_ref(self, target, vid, vname):
        if vid in self.global_vars:
            return prop('G', self.global_vars[vid])
        local = self.local_names.get(vid, vname)
        return prop('t.v', local)

    # -----------------------------------------------------------------------
    # Inputs (the round/hexagon slots in a block)
    # -----------------------------------------------------------------------
    def inp(self, block, name, kind='any'):
        """Return JavaScript code for the value plugged into input `name`.
        kind is the type the block wants: 'num', 'str', 'bool' or 'any'."""
        i = block['inputs'].get(name)
        if i is None:
            return {'num': '0', 'str': '""', 'bool': 'false'}.get(kind, '""')
        val = i[1]
        if val is None:
            return {'num': '0', 'str': '""', 'bool': 'false'}.get(kind, '""')
        if isinstance(val, list):
            return self.primitive(val, kind)
        return self.cast(self.expr(val), kind)

    def primitive(self, prim, kind):
        """Literal values typed straight into a slot."""
        ptype, value = prim[0], prim[1]
        if ptype == 12:   # a variable dropped into the slot
            code = self.var_ref(self.target, prim[2], value)
            return self.cast((code, 'any'), kind)
        if ptype == 11:   # broadcast name
            return js_str(value)
        if ptype in (4, 5, 6, 7, 8):   # number slots
            if kind in ('num', 'any') and is_num_literal(value):
                return num_literal(value) if kind == 'num' else js_str(value)
            if kind == 'num':
                return f'num({js_str(value)})'
            return js_str(value)
        # text / color
        if kind == 'num':
            return num_literal(value) if is_num_literal(value) else f'num({js_str(value)})'
        if kind == 'bool':
            return f'bool({js_str(value)})'
        return js_str(value)

    def cast(self, code_type, kind):
        code, typ = code_type
        if kind == 'any' or kind == typ:
            return code
        if kind == 'num':
            return f'num({code})'
        if kind == 'str':
            return f'str({code})'
        if kind == 'bool':
            return code if typ == 'bool' else f'bool({code})'
        return code

    def field(self, block, name):
        return block['fields'][name][0]

    def menu(self, block, input_name, field_name):
        """Menus are tiny shadow blocks holding a field. Return JS for the chosen value."""
        i = block['inputs'].get(input_name)
        if i is None:
            return '""'
        ref = i[1]
        if isinstance(ref, list):
            return self.primitive(ref, 'any')
        b = self.blocks[ref]
        if b.get('shadow') and field_name in b['fields']:
            return js_str(b['fields'][field_name][0])
        return self.expr(ref)[0]   # a reporter was dropped onto the menu

    # -----------------------------------------------------------------------
    # Reporters and booleans -> (code, type)
    # -----------------------------------------------------------------------
    def expr(self, bid):
        b = self.blocks[bid]
        op = b['opcode']
        I = lambda n, k='any': self.inp(b, n, k)

        if op == 'operator_add':      return f'({I("NUM1","num")} + {I("NUM2","num")})', 'num'
        if op == 'operator_subtract': return f'({I("NUM1","num")} - {I("NUM2","num")})', 'num'
        if op == 'operator_multiply': return f'({I("NUM1","num")} * {I("NUM2","num")})', 'num'
        if op == 'operator_divide':   return f'({I("NUM1","num")} / {I("NUM2","num")})', 'num'
        if op == 'operator_random':   return f'random({I("FROM")}, {I("TO")})', 'num'
        if op == 'operator_equals':   return f'eq({I("OPERAND1")}, {I("OPERAND2")})', 'bool'
        if op == 'operator_gt':       return f'gt({I("OPERAND1")}, {I("OPERAND2")})', 'bool'
        if op == 'operator_lt':       return f'lt({I("OPERAND1")}, {I("OPERAND2")})', 'bool'
        if op == 'operator_and':      return f'({I("OPERAND1","bool")} && {I("OPERAND2","bool")})', 'bool'
        if op == 'operator_or':       return f'({I("OPERAND1","bool")} || {I("OPERAND2","bool")})', 'bool'
        if op == 'operator_not':      return f'!{I("OPERAND","bool")}', 'bool'
        if op == 'operator_join':     return f'join({I("STRING1")}, {I("STRING2")})', 'str'
        if op == 'operator_letter_of':return f'letterOf({I("LETTER","num")}, {I("STRING")})', 'str'

        if op == 'motion_xposition':  return 't.xPos', 'num'
        if op == 'motion_yposition':  return 't.yPos', 'num'
        if op == 'looks_costumenumbername':
            return ('t.costumeName', 'str') if self.field(b, 'NUMBER_NAME') == 'name' else ('t.costumeNumber', 'num')
        if op == 'sensing_mousex':    return 'rt.mouseX', 'num'
        if op == 'sensing_mousey':    return 'rt.mouseY', 'num'
        if op == 'sensing_mousedown': return 'rt.mouseDown', 'bool'
        if op == 'sensing_answer':    return 'rt.answer', 'str'
        if op == 'sensing_touchingobject':
            return f't.touching({self.menu(b, "TOUCHINGOBJECTMENU", "TOUCHINGOBJECTMENU")})', 'bool'
        if op == 'sensing_of':
            obj = self.menu(b, 'OBJECT', 'OBJECT')
            return f'rt.of({obj}, {js_str(self.field(b, "PROPERTY"))})', 'any'
        if op == 'data_variable':
            f = b['fields']['VARIABLE']
            return self.var_ref(self.target, f[1], f[0]), 'any'

        # menus used as reporters
        for menu_op, fname in [('looks_costume', 'COSTUME'), ('sound_sounds_menu', 'SOUND_MENU'),
                               ('motion_goto_menu', 'TO'), ('sensing_of_object_menu', 'OBJECT'),
                               ('sensing_touchingobjectmenu', 'TOUCHINGOBJECTMENU'),
                               ('control_create_clone_of_menu', 'CLONE_OPTION')]:
            if op == menu_op:
                return js_str(self.field(b, fname)), 'str'

        raise ValueError(f'Unknown reporter {op} in {self.target["name"]}')

    # -----------------------------------------------------------------------
    # Stacks of command blocks -> lines of code
    # -----------------------------------------------------------------------
    def stack(self, bid, depth):
        out = []
        while bid:
            out += self.statement(bid, depth)
            bid = self.blocks[bid]['next']
        return out

    def sub(self, b, name, depth):
        i = b['inputs'].get(name)
        if not i or not i[1]:
            return []
        return self.stack(i[1], depth)

    def statement(self, bid, d):
        b = self.blocks[bid]
        op = b['opcode']
        pad = '  ' * d
        I = lambda n, k='any': self.inp(b, n, k)
        L = lambda s: [pad + s]

        # ---- motion ----
        if op == 'motion_gotoxy':      return L(f't.goTo({I("X","num")}, {I("Y","num")});')
        if op == 'motion_changexby':   return L(f't.changeX({I("DX","num")});')
        if op == 'motion_changeyby':   return L(f't.changeY({I("DY","num")});')
        if op == 'motion_setx':        return L(f't.setX({I("X","num")});')
        if op == 'motion_sety':        return L(f't.setY({I("Y","num")});')
        if op == 'motion_goto':        return L(f't.goToTarget({self.menu(b,"TO","TO")});')
        if op == 'motion_glidesecstoxy':
            return L(f'yield* t.glide({I("SECS","num")}, {I("X","num")}, {I("Y","num")});')
        if op == 'motion_movesteps':   return L(f't.move({I("STEPS","num")});')
        if op == 'motion_turnright':   return L(f't.turn({I("DEGREES","num")});')
        if op == 'motion_setrotationstyle': return L(f't.rotationStyle = {js_str(self.field(b,"STYLE"))};')

        # ---- looks ----
        if op == 'looks_show':         return L('t.show();')
        if op == 'looks_hide':         return L('t.hide();')
        if op == 'looks_switchcostumeto': return L(f't.costume({self.menu(b,"COSTUME","COSTUME")});')
        if op == 'looks_nextcostume':  return L('t.nextCostume();')
        if op == 'looks_setsizeto':    return L(f't.setSize({I("SIZE","num")});')
        if op == 'looks_changesizeby': return L(f't.setSize(t.size + {I("CHANGE","num")});')
        if op == 'looks_seteffectto':
            return L(f't.setEffect({js_str(self.field(b,"EFFECT").lower())}, {I("VALUE","num")});')
        if op == 'looks_changeeffectby':
            e = js_str(self.field(b, "EFFECT").lower())
            return L(f't.setEffect({e}, t.effect({e}) + {I("CHANGE","num")});')
        if op == 'looks_cleargraphiceffects': return L('t.clearEffects();')
        if op == 'looks_gotofrontback':
            return L('t.goToFront();' if self.field(b, 'FRONT_BACK') == 'front' else 't.goToBack();')
        if op == 'looks_goforwardbackwardlayers':
            sign = '' if self.field(b, 'FORWARD_BACKWARD') == 'forward' else '-'
            return L(f't.moveLayers({sign}{I("NUM","num")});')

        # ---- sound ----
        if op == 'sound_play':         return L(f't.playSound({self.menu(b,"SOUND_MENU","SOUND_MENU")});')
        if op == 'sound_playuntildone':return L(f'yield* t.playSoundUntilDone({self.menu(b,"SOUND_MENU","SOUND_MENU")});')
        if op == 'sound_setvolumeto':  return L(f't.setVolume({I("VOLUME","num")});')
        if op == 'sound_stopallsounds':return L('rt.stopAllSounds();')

        # ---- events ----
        if op == 'event_broadcast':    return L(f'rt.broadcast({I("BROADCAST_INPUT","str")});')
        if op == 'event_broadcastandwait': return L(f'yield* rt.broadcastAndWait({I("BROADCAST_INPUT","str")});')

        # ---- control ----
        if op == 'control_wait':       return L(f'yield* rt.wait({I("DURATION","num")});')
        if op == 'control_wait_until': return L(f'yield* rt.waitUntil(() => {I("CONDITION","bool")});')
        if op == 'control_forever':
            return [pad + 'while (true) {'] + self.sub(b, 'SUBSTACK', d + 1) + [pad + '  yield;', pad + '}']
        if op == 'control_repeat':
            self.loop_n += 1
            v = f'i{self.loop_n}'
            return ([pad + f'for (let {v} = Math.round({I("TIMES","num")}); {v} > 0; {v}--) {{']
                    + self.sub(b, 'SUBSTACK', d + 1) + [pad + '  yield;', pad + '}'])
        if op == 'control_repeat_until':
            return ([pad + f'while (!{I("CONDITION","bool")}) {{']
                    + self.sub(b, 'SUBSTACK', d + 1) + [pad + '  yield;', pad + '}'])
        if op == 'control_if':
            return [pad + f'if ({I("CONDITION","bool")}) {{'] + self.sub(b, 'SUBSTACK', d + 1) + [pad + '}']
        if op == 'control_if_else':
            return ([pad + f'if ({I("CONDITION","bool")}) {{'] + self.sub(b, 'SUBSTACK', d + 1)
                    + [pad + '} else {'] + self.sub(b, 'SUBSTACK2', d + 1) + [pad + '}'])
        if op == 'control_stop':
            opt = self.field(b, 'STOP_OPTION')
            if opt == 'all':          return L('rt.stopAll(); return;')
            if opt == 'this script':  return L('return;')
            return L('rt.stopOtherScripts(t);')
        if op == 'control_create_clone_of':
            return L(f'rt.createClone(t, {self.menu(b,"CLONE_OPTION","CLONE_OPTION")});')
        if op == 'control_delete_this_clone':
            return L('rt.deleteClone(t); return;')

        # ---- data ----
        if op == 'data_setvariableto':
            f = b['fields']['VARIABLE']
            return L(f'{self.var_ref(self.target, f[1], f[0])} = {I("VALUE")};')
        if op == 'data_changevariableby':
            f = b['fields']['VARIABLE']
            ref = self.var_ref(self.target, f[1], f[0])
            return L(f'{ref} = num({ref}) + {I("VALUE","num")};')

        # ---- sensing ----
        if op == 'sensing_askandwait': return L(f'yield* rt.ask({I("QUESTION","str")});')
        if op == 'sensing_setdragmode':
            return L(f't.draggable = {str(self.field(b,"DRAG_MODE") == "draggable").lower()};')

        raise ValueError(f'Unknown command {op} in {self.target["name"]}')

    # -----------------------------------------------------------------------
    # Hats (the blocks that start a script)
    # -----------------------------------------------------------------------
    def hat(self, bid):
        b = self.blocks[bid]
        op = b['opcode']
        if op == 'event_whenflagclicked':      return '"flag"', 'when green flag clicked'
        if op == 'event_whenthisspriteclicked':return '"click"', 'when this sprite clicked'
        if op == 'control_start_as_clone':     return '"clone"', 'when I start as a clone'
        if op == 'event_whenbroadcastreceived':
            name = self.field(b, 'BROADCAST_OPTION')
            return f'"broadcast", {js_str(name)}', f'when I receive [{name}]'
        if op == 'event_whenkeypressed':
            k = self.field(b, 'KEY_OPTION')
            return f'"key", {js_str(k)}', f'when [{k}] key pressed'
        if op == 'makeymakey_whenMakeyKeyPressed':
            k = self.menu(b, 'KEY', 'KEY')
            return f'"keyHeld", {k}', f'while key {k} is held (Makey Makey block)'
        if op == 'makeymakey_whenCodePressed':
            s = self.menu(b, 'SEQUENCE', 'SEQUENCE')
            return f'"keySequence", {s}', f'when arrow keys {s} are pressed in order (Makey Makey block)'
        return None, None

    def target_js(self, target):
        self.target = target
        self.blocks = target['blocks']
        self.loop_n = 0
        # give duplicate local variable names a unique suffix
        self.local_names, seen = {}, {}
        for vid, v in target['variables'].items():
            if target['isStage']:
                continue
            n = v[0]
            seen[n] = seen.get(n, 0) + 1
            self.local_names[vid] = n if seen[n] == 1 else f'{n} ({seen[n]})'

        name = target['name']
        lines = [f'// {"=" * 70}', f'// {"Stage (backdrop)" if target["isStage"] else "Sprite: " + name}',
                 f'// {"=" * 70}', f'scripts({js_str(name)}, t => {{']
        # top level hats, sorted top-to-bottom like the Scratch editor shows them
        tops = [(bid, b) for bid, b in self.blocks.items()
                if isinstance(b, dict) and b.get('topLevel') and not b.get('shadow')]
        tops.sort(key=lambda kv: (kv[1].get('y', 0), kv[1].get('x', 0)))
        count = 0
        for bid, b in tops:
            args, label = self.hat(bid)
            if not args:
                continue   # loose blocks that are not attached to a hat never run
            body = self.stack(b['next'], 2)
            if not body:
                continue   # empty hats do nothing
            count += 1
            lines.append(f'  // {label}')
            lines.append(f'  t.on({args}, function* (t) {{')
            lines += body
            lines.append('  });')
            lines.append('')
        if lines[-1] == '':
            lines.pop()
        lines.append('});')
        return '\n'.join(lines), count


def convert(project, skip=()):
    c = Converter(project)
    parts, total = [], 0
    for t in project['targets']:
        if t['name'] in skip:
            continue
        js, n = c.target_js(t)
        parts.append(js)
        total += n
    return '\n\n'.join(parts) + '\n', total


if __name__ == '__main__':
    proj = json.load(open(sys.argv[1]))
    js, n = convert(proj)
    sys.stdout.write(js)
    sys.stderr.write(f'converted {n} scripts\n')
