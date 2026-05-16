-- require("boom") in init.lua to use

local function playBoom()
  -- edit this command acc to ur system
  vim.system({ 'paplay', '/home/sahaj/media/boom2.ogg', '--volume=35536' }, { detach = true })
end

local function get_diag_key(diag)
  return string.format("%s:%s:%s", diag.code or '', diag.source or '', diag.message or '')
  -- return string.format("%d:%d:%s:%s:%s", diag.lnum, diag.col, diag.code or '', diag.source or '', diag.message or '')
end

local function update_prev_errors()
  local current_errors = {}
  for _, diag in ipairs(vim.diagnostic.get(0, { severity = vim.diagnostic.severity.ERROR })) do
    local key = get_diag_key(diag)
    current_errors[key] = true
  end
  -- vim.system({ 'notify-send', "SET" .. vim.inspect(current_errors) }, { detach = true })
  vim.b.prev_error_keys = current_errors
end


local function compare_and_boom()
  local current_errors = {}
  for _, diag in ipairs(vim.diagnostic.get(0, { severity = vim.diagnostic.severity.ERROR })) do
    local key = get_diag_key(diag)
    current_errors[key] = true
  end

  local prev_keys = vim.b.prev_error_keys or {}
  -- local new_count = 0
  -- vim.system({ 'notify-send', "PREV" .. vim.inspect(prev_keys) }, { detach = true })
  -- vim.system({ 'notify-send', "CURR" .. vim.inspect(current_errors) }, { detach = true })
  for key in pairs(current_errors) do
    if not prev_keys[key] then
      -- new_count = new_count + 1
      playBoom()
      break
    end
  end

  -- for _ = 1, new_count do
  --   playBoom()
  -- end

  vim.b.prev_error_keys = current_errors
end

vim.api.nvim_create_autocmd('ModeChanged', {
  pattern = 'n:*', -- leaving normal mode
  callback = update_prev_errors,
})

vim.api.nvim_create_autocmd('DiagnosticChanged', {
  callback = function()
    if vim.fn.mode() == 'n' then
      compare_and_boom()
    end
  end,

})

vim.api.nvim_create_autocmd('ModeChanged', {
  pattern = '*:n', -- entering normal mode
  callback = compare_and_boom,
})
