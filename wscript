import Options
from os import unlink, symlink, popen
from os.path import exists 

srcdir = '.'
blddir = 'build'
VERSION = '0.1.0'

def set_options(opt):
  opt.tool_options('compiler_cxx')

def configure(conf):
  conf.check_tool('compiler_cxx')
  conf.check_tool('node_addon')

def build(bld):
  obj = bld.new_task_gen('cxx', 'shlib', 'node_addon')
  obj.target = 'loop'
  obj.source = "src/loop.cc"


def shutdown():
  # HACK to get binding.node out of build directory.
  # better way to do this?
  if Options.commands['clean']:
    if exists('loop.node'): unlink('loop.node')
  else:
    if exists('build/default/loop.node') and not exists('loop.node'):
      symlink('build/default/loop.node', 'loop.node')
