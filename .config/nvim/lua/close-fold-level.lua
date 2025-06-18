return function(target_level)
  local ufo = require('ufo')
  local bufnr = vim.api.nvim_get_current_buf()

  -- Get the fold buffer from ufo
  local fb = ufo.getFolds and require('ufo.fold').get(bufnr) or nil
  if not fb or not fb.foldRanges then
    vim.notify("No fold ranges found", vim.log.levels.WARN)
    return
  end

  -- First, open all folds
  vim.cmd('silent! %foldopen!')

  -- Calculate nesting level for each fold range
  local ranges_with_levels = {}
  for i, range in ipairs(fb.foldRanges) do
    local level = 1
    -- Count how many other ranges completely contain this range
    for j, other_range in ipairs(fb.foldRanges) do
      if i ~= j and
          other_range.startLine < range.startLine and
          other_range.endLine > range.endLine then
        level = level + 1
      end
    end
    table.insert(ranges_with_levels, { range = range, level = level })
  end

  -- Close only folds at the target level
  local cmds = {}
  for _, item in ipairs(ranges_with_levels) do
    if item.level == target_level then
      local startLnum = item.range.startLine + 1 -- Convert to 1-indexed
      local endLnum = item.range.endLine + 1
      fb:closeFold(startLnum, endLnum)
      table.insert(cmds, startLnum .. 'foldclose')
    end
  end

  -- Execute fold commands
  if #cmds > 0 then
    vim.cmd(table.concat(cmds, '|'))
  end
end
