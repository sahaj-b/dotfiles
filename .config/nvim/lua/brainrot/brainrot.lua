local media = vim.fn.stdpath('config') .. '/lua/brainrot/'

local PHONK_TIME = 2.5
local DISBALE_PHONK = false

local function playBoom()
  vim.system({ 'paplay', media .. 'boom2.ogg', '--volume=35536' }, { detach = true })
end

local function playRandomPhonk()
  local glob_pattern = media .. 'phonks/*'
  local files = vim.fn.glob(glob_pattern, false, true)
  if #files == 0 then
    vim.notify("Error: No sound files found in './phonks/' directory.", vim.log.levels.ERROR)
    return
  end
  local idx = math.random(#files)
  local path = files[idx]
  vim.system({ 'timeout', tostring(PHONK_TIME), 'paplay', path, '--volume=35536' }, { detach = true })
end

local function showRandomImage()
  local glob_pattern = media .. 'images/*.png'
  local files = vim.fn.glob(glob_pattern, false, true)
  if #files == 0 then
    vim.notify("Error: No PNG files found in 'brainrot/images/' directory.", vim.log.levels.ERROR)
    return
  end
  local idx = math.random(#files)
  local path = files[idx]
  local w, h = 30, 30
  local wh = vim.api.nvim_win_get_height(0)
  local total_lines = vim.api.nvim_buf_line_count(0)
  local top_line = vim.fn.line('w0')
  local visible_y = math.floor(wh * 0.6)
  local buffer_y = top_line + visible_y - 1
  buffer_y = math.max(1, math.min(buffer_y, total_lines))

  local x = math.floor((vim.o.columns - w) / 2)

  local img = require("image").from_file(path, {
    x = x,
    y = buffer_y,
    width = w,
    height = h,
    window = vim.api.nvim_get_current_win(),
  })

  if not img then
    vim.notify("image.nvim failed to load", vim.log.levels.ERROR)
    return
  end

  img:render()

  vim.defer_fn(function() img:clear() end, PHONK_TIME * 1000)
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

function Phonk()
  local buf = vim.api.nvim_create_buf(false, true)
  vim.bo[buf].bufhidden = 'wipe'
  local opts = {
    relative = 'editor',
    width = vim.o.columns,
    height = vim.o.lines - 1,
    row = 1,
    col = 0,
    style = 'minimal',
    border = 'none',
  }
  local win = vim.api.nvim_open_win(buf, false, opts)
  vim.wo[win].winblend = 70

  vim.api.nvim_set_hl(0, 'DimOverlay', { bg = '#000000' })
  vim.wo[win].winhl = 'Normal:DimOverlay'

  -- local freeze_keys = { '<Esc>', '<C-c>', 'q', '<C-[>', 'i', 'a', 'o', 'dd', 'yy' }
  -- for _, key in ipairs(freeze_keys) do
  --   vim.keymap.set({ 'n', 'i' }, key, '<nop>', { buffer = 0, silent = true }) -- Apply to main buffer
  -- end
  showRandomImage()
  playRandomPhonk()
  vim.defer_fn(function()
    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_close(win, true)
    end
    vim.cmd('redraw!')
    -- for _, key in ipairs(freeze_keys) do
    --   vim.keymap.del({ 'n', 'i' }, key, { buffer = 0 })
    -- end
  end, PHONK_TIME * 1000)
end

local function compare_and_play()
  local current_errors = {}
  for _, diag in ipairs(vim.diagnostic.get(0, { severity = vim.diagnostic.severity.ERROR })) do
    local key = get_diag_key(diag)
    current_errors[key] = true
  end

  local prev_keys = vim.b.prev_error_keys or {}
  if not DISBALE_PHONK then
    local prev_count = 0
    for _ in pairs(prev_keys) do prev_count = prev_count + 1 end
    if prev_count > 0 and next(current_errors) == nil then
      Phonk()
    end
  end

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
      compare_and_play()
    end
  end,

})

vim.api.nvim_create_autocmd('ModeChanged', {
  pattern = '*:n', -- entering normal mode
  callback = compare_and_play,
})
