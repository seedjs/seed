// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license
// ==========================================================================

// Expose loop/unloop actions from libev

#include <node.h>
#include <string.h>

using namespace v8;

static Handle<Value> Loop(const Arguments& args) {
  HandleScope scope;
  ev_loop(EV_DEFAULT_UC_ 0);
  return Undefined();
}

static Handle<Value> Unloop(const Arguments& args) {
  HandleScope scope;
  int how = EVUNLOOP_ONE;
  if (args[0]->IsString()) {
    String::Utf8Value how_s(args[0]->ToString());
    if (0 == strcmp(*how_s, "all")) {
      how = EVUNLOOP_ALL;
    }
  }
  ev_unloop(EV_DEFAULT_ how);
  return Undefined();
}

extern "C" void
init (Handle<Object> target) 
{
  HandleScope scope;
  target->Set(
    String::NewSymbol("loop"), 
    FunctionTemplate::New(Loop)->GetFunction());
  
  target->Set(
    String::NewSymbol("unloop"), 
    FunctionTemplate::New(Unloop)->GetFunction());
}

