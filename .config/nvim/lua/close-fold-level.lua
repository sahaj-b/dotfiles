function CloseLevelRange(target_level, start_line, end_line)
  local bufnr = vim.api.nvim_get_current_buf()
  local total = vim.api.nvim_buf_line_count(bufnr)

  -- Default to whole file if range not provided
  if not start_line then start_line = 1 end
  if not end_line then end_line = total end

  start_line = math.max(1, start_line)
  end_line = math.min(total, end_line)

  -- open folds in range
  vim.cmd('silent! ' .. start_line .. ',' .. end_line .. 'foldopen!')

  -- Collect fold ranges using foldlevel, limited to the range
  local folds = {}
  local stack = {}
  local prev_level = 0
  for lnum = start_line, end_line + 1 do
    local level = 0
    if lnum <= end_line then
      level = vim.fn.foldlevel(lnum)
      if level == -1 then
        level = prev_level
      end
    end
    while #stack > 0 and level < stack[#stack].level do
      local open_fold = table.remove(stack)
      local end_line_fold = lnum - 1
      -- Only add if the fold is fully within the range
      if open_fold.start >= start_line and end_line_fold <= end_line and end_line_fold > open_fold.start then
        table.insert(folds, { startLine = open_fold.start, level = open_fold.level })
      end
    end
    if lnum <= end_line and level > prev_level then
      table.insert(stack, { start = lnum, level = level })
    end
    prev_level = level
  end

  -- -- Close any dangling folds at range end (if they started in range)
  -- while #stack > 0 do
  --   local open_fold = table.remove(stack)
  --   local end_line_fold = end_line
  --   if open_fold.start >= start_line and end_line_fold <= end_line and end_line_fold > open_fold.start then
  --     table.insert(folds, { startLine = open_fold.start, level = open_fold.level })
  --   end
  -- end

  if #folds == 0 then
    vim.notify("No fold ranges found in range ", vim.log.levels.WARN)
    return
  end

  -- Close only folds at the target level, deduplicating by start line
  local seen_cmds = {}
  local cmds = {}
  for _, item in ipairs(folds) do
    if item.level == target_level then
      local startLnum = item.startLine
      local cmd = startLnum .. 'foldclose'
      if not seen_cmds[startLnum] then
        seen_cmds[startLnum] = true
        table.insert(cmds, cmd)
      end
    end
  end

  -- Execute fold commands
  if #cmds > 0 then
    vim.cmd(table.concat(cmds, '|'))
  end
end

return function(level)
  local cur_line = vim.fn.line('.')
  local vis_line = vim.fn.line('v')
  if cur_line == vis_line then
    -- Normal mode: whole file
    CloseLevelRange(level)
  else
    -- Visual mode: range
    local start_line = math.min(cur_line, vis_line)
    local end_line = math.max(cur_line, vis_line)
    vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes('<Esc>', true, false, true), 'n', false)
    CloseLevelRange(level, start_line, end_line)
  end
end


----- These below doesn't handle ranges -----

-- more complicated which calculates nesting level again manually, to avoid edge cases
-- function closeLevel(target_level)
--   local bufnr = vim.api.nvim_get_current_buf()
--
--   -- First, open all folds
--   vim.cmd('silent! %foldopen!')
--
--   -- Collect fold ranges using foldlevel
--   local folds = {}
--   local stack = {}
--   local prev_level = 0
--   local total = vim.api.nvim_buf_line_count(bufnr)
--   for lnum = 1, total + 1 do
--     local level = 0
--     if lnum <= total then
--       level = vim.fn.foldlevel(lnum)
--       if level == -1 then
--         level = prev_level
--       end
--     end
--     while #stack > 0 and level < stack[#stack].level do
--       local open_fold = table.remove(stack)
--       local end_line = lnum - 1
--       if end_line > open_fold.start then
--         table.insert(folds, { startLine = open_fold.start, endLine = end_line })
--       end
--     end
--     if lnum <= total and level > prev_level then
--       table.insert(stack, { start = lnum, level = level })
--     end
--     prev_level = level
--   end
--
--   if #folds == 0 then
--     vim.notify("No fold ranges found", vim.log.levels.WARN)
--     return
--   end
--
--   -- Calculate nesting level for each fold range
--   local ranges_with_levels = {}
--   for i, range in ipairs(folds) do
--     local level = 1
--     -- Count how many other ranges completely contain this range
--     for j, other_range in ipairs(folds) do
--       if i ~= j and
--           other_range.startLine < range.startLine and
--           other_range.endLine > range.endLine then
--         level = level + 1
--       end
--     end
--     table.insert(ranges_with_levels, { range = range, level = level })
--   end
--
--   -- Close only folds at the target level, deduplicating by start line
--   local seen_cmds = {}
--   local cmds = {}
--   for _, item in ipairs(ranges_with_levels) do
--     if item.level == target_level then
--       local startLnum = item.range.startLine
--       local cmd = startLnum .. 'foldclose'
--       if not seen_cmds[startLnum] then
--         seen_cmds[startLnum] = true
--         table.insert(cmds, cmd)
--       end
--     end
--   end
--
--   -- Execute fold commands
--   if #cmds > 0 then
--     vim.cmd(table.concat(cmds, '|'))
--   end
-- end


-- this one uses UFO plugin, lil less complex
-- function closeLevel(target_level)
--   local ufo = require('ufo')
--   local bufnr = vim.api.nvim_get_current_buf()
--
--   -- Get the fold buffer from ufo
--   local fb = ufo.getFolds and require('ufo.fold').get(bufnr) or nil
--   if not fb or not fb.foldRanges then
--     vim.notify("No fold ranges found", vim.log.levels.WARN)
--     return
--   end
--
--   -- First, open all folds
--   vim.cmd('silent! %foldopen!')
--
--   -- Calculate nesting level for each fold range
--   local ranges_with_levels = {}
--   for i, range in ipairs(fb.foldRanges) do
--     local level = 1
--     -- Count how many other ranges completely contain this range
--     for j, other_range in ipairs(fb.foldRanges) do
--       if i ~= j and
--           other_range.startLine < range.startLine and
--           other_range.endLine > range.endLine then
--         level = level + 1
--       end
--     end
--     table.insert(ranges_with_levels, { range = range, level = level })
--   end
--
--   -- Close only folds at the target level, deduplicating by start line
--   local seen_cmds = {}
--   local cmds = {}
--   for _, item in ipairs(ranges_with_levels) do
--     if item.level == target_level then
--       local startLnum = item.range.startLine + 1 -- Convert to 1-indexed
--       local cmd = startLnum .. 'foldclose'
--       if not seen_cmds[startLnum] then
--         seen_cmds[startLnum] = true
--         table.insert(cmds, cmd)
--       end
--     end
--   end
--
--   -- Execute fold commands
--   if #cmds > 0 then
--     vim.cmd(table.concat(cmds, '|'))
--   end
-- end
