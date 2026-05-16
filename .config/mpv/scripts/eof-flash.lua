mp.observe_property('eof-reached', 'native', function(_, value)
  if value then
    mp.commandv('script-binding', 'uosc/flash-pause-indicator')
  end
end)
