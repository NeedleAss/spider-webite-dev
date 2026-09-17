#!/usr/bin/env python3
import os,sys
from pathlib import Path
root=Path(__file__).resolve().parent.parent
args=sys.argv[1:]
if args and args[0]=='compile':args+=['--build-property','runtime.tools.ctags.path='+str(root/'build/deps/ctags-native/ctags-5.8-arduino11')]
os.execv('/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli',['arduino-cli',*args])
