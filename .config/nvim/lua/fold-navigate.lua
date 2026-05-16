return function(direction)
  local cur_line = vim.fn.line('.')
  local total_lines = vim.fn.line('$')
  local start_line

  if direction == 'next' then
    -- If in a closed fold, skip to after its end
    if vim.fn.foldclosed(cur_line) ~= -1 then
      start_line = vim.fn.foldclosedend(cur_line) + 1
    else
      start_line = cur_line + 1
    end

    for line = start_line, total_lines do
      if vim.fn.foldclosed(line) == line then -- Found a closed fold start
        vim.api.nvim_win_set_cursor(0, { line, 0 })
        vim.cmd('normal! zz')                 -- Center the screen (optional, remove if you hate it)
        return
      end
    end
    -- No next closed fold? Could add vim.notify('No more closed folds ahead') here
  elseif direction == 'prev' then
    -- If in a closed fold, skip to before its start
    if vim.fn.foldclosed(cur_line) ~= -1 then
      start_line = vim.fn.foldclosed(cur_line) - 1
    else
      start_line = cur_line - 1
    end

    for line = start_line, 1, -1 do
      if vim.fn.foldclosed(line) == line then
        vim.api.nvim_win_set_cursor(0, { line, 0 })
        vim.cmd('normal! zz')
        return
      end
    end
    -- Same, notify if none found
  else
    print('Direction must be "next" or "prev", bro.')
  end
end
