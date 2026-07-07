// ==========================================================
// PROSTORS TEMPLATE - BACKEND (Google Apps Script)
// Версия: 1.0.0
// ==========================================================

var SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function hashPin(pin) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pin);
  return rawHash.map(function(byte) {
    var v = (byte < 0) ? 256 + byte : byte;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function formatDate(dateObj) {
  if (!dateObj) return '';
  var d = new Date(dateObj);
  if (isNaN(d.getTime())) return String(dateObj);
  var day = ('0' + d.getDate()).slice(-2);
  var month = ('0' + (d.getMonth() + 1)).slice(-2);
  var year = d.getFullYear();
  var hours = ('0' + d.getHours()).slice(-2);
  var minutes = ('0' + d.getMinutes()).slice(-2);
  return day + '.' + month + '.' + year + ' ' + hours + ':' + minutes;
}

function parseDateFromSheet(dateStr) {
  if (!dateStr) return new Date(0);
  var parts = String(dateStr).split(' ');
  var dateParts = parts[0].split('.');
  var timeParts = parts[1] ? parts[1].split(':') : ['0', '0'];
  return new Date(
    parseInt(dateParts[2]),
    parseInt(dateParts[1]) - 1,
    parseInt(dateParts[0]),
    parseInt(timeParts[0]),
    parseInt(timeParts[1])
  );
}

function extractUserIdFromInitData(initData) {
  try {
    if (!initData) return null;
    var params = {};
    initData.split('&').forEach(function(pair) {
      var parts = pair.split('=');
      params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
    });
    if (params.user) {
      var user = JSON.parse(params.user);
      return user.id;
    }
  } catch (e) {
    Logger.log('[extractUserIdFromInitData] Error: ' + e.toString());
  }
  return null;
}

// === ПРОВЕРКА ДОСТУПА ===

function checkAgentAccess(agentId, initData, isAdminMode) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var agentsSheet = ss.getSheetByName('Agents');
    if (!agentsSheet || agentsSheet.getLastRow() < 2) {
      return { allowed: false, error: 'Агенты не настроены' };
    }
    var data = agentsSheet.getDataRange().getValues();
    var headers = data[0];
    var idIdx = headers.indexOf('agent_id');
    var statusIdx = headers.indexOf('status');
    var expiresIdx = headers.indexOf('expires_at');
    var telegramIdx = headers.indexOf('telegram_user_id');
    var chatIdx = headers.indexOf('chat_id');

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]).trim() === String(agentId).trim()) {
        var status = String(data[i][statusIdx] || '').trim();
        var expiresAt = data[i][expiresIdx];
        var telegramUserId = data[i][telegramIdx];
        var chatId = data[i][chatIdx];

        if (status !== 'active') return { allowed: false, error: 'Агент неактивен' };
        if (expiresAt && new Date(expiresAt) < new Date()) return { allowed: false, error: 'Подписка истекла' };
        if (isAdminMode) return { allowed: true, chatId: chatId || telegramUserId };

        if (initData && telegramUserId) {
          var userId = extractUserIdFromInitData(initData);
          if (String(userId) !== String(telegramUserId)) {
            return { allowed: false, error: 'Неверный пользователь' };
          }
        }
        return { allowed: true, chatId: chatId || telegramUserId };
      }
    }
    return { allowed: false, error: 'Агент не найден' };
  } catch (e) {
    return { allowed: false, error: e.toString() };
  }
}

// === ГЛАВНЫЕ ТОЧКИ ВХОДА (API) ===

function doGet(e) {
  try {
    var action = e.parameter.action || '';
    var agentId = e.parameter.agent_id || '';
    var isAdminMode = e.parameter.admin === '1';

    if (action === 'get_listings' || action === 'get_all' || !action) {
      return getListings(agentId, e.parameter.includeHidden === 'true');
    }
    if (action === 'get_agent_config') return getAgentConfig(agentId, e.parameter.user_id);
    if (action === 'resolve_agent_by_domain') return resolveAgentByDomain(e.parameter.domain);
    if (action === 'get_last_file_url') return getLastFileUrl();

    var access = checkAgentAccess(agentId, null, isAdminMode);
    if (!access.allowed) {
      return jsonResponse({ success: false, error: access.error || 'Агент не найден или неактивен' });
    }

    if (action === 'verify_pin') return verifyPin(agentId, e.parameter.pin);
    if (action === 'get_agent_profile') return getAgentProfile(agentId);
    if (action === 'get_pages') return getPagesData(agentId);
    if (action === 'get_leads') return getLeads(agentId);

    return jsonResponse({ success: false, error: 'Неизвестное действие: ' + action });
  } catch (error) {
    Logger.log('[doGet] Error: ' + error.toString());
    return jsonResponse({ success: false, error: 'Ошибка сервера: ' + error.toString() });
  }
}

function doPost(e) {
  try {
    // Обработка webhook от Telegram (если настроен напрямую на Apps Script)
    if (e.postData && e.postData.contents && e.postData.contents.indexOf('"update_id"') !== -1) {
      return processTelegramWebhook(e);
    }

    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var agentId = postData.agentId || '';
    var data = postData.data || {};
    var isAdminMode = postData.isAdminMode || false;

    if (action === 'save_lead') {
      var leadAccess = checkAgentAccess(agentId, null, false);
      if (!leadAccess.allowed) return jsonResponse({ success: false, error: 'Агент недоступен' });
      return saveLead(data, agentId, leadAccess.chatId);
    }

    var access = checkAgentAccess(agentId, postData.initData, isAdminMode);
    if (!access.allowed) return jsonResponse({ success: false, error: 'Доступ запрещён' });

    if (action === 'upload_image') return uploadImage(data, agentId);
    if (action === 'create') return handleCreate(data, agentId);
    if (action === 'update') return handleUpdate(data, agentId);
    if (action === 'delete') return handleDelete(data, agentId);
    if (action === 'update_lead_status') return updateLeadStatus(data.id, data.status, agentId);
    if (action === 'update_agent_profile') return updateAgentProfile(data, agentId);
    if (action === 'update_page') return updatePage(data.page, data.title, data.content, agentId);
    if (action === 'change_pin') return changeAgentPin(agentId, postData.oldPin, postData.newPin);

    return jsonResponse({ success: false, error: 'Недопустимое действие: ' + action });
  } catch (error) {
    Logger.log('[doPost] Error: ' + error.toString());
    return jsonResponse({ success: false, error: 'Ошибка сервера: ' + error.toString() });
  }
}

// === БИЗНЕС-ЛОГИКА: ОБЪЕКТЫ (LISTINGS) ===

function getListings(agentId, includeHidden) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Listings');
    if (!sheet) return jsonResponse({ success: true, data: [] });

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return jsonResponse({ success: true, data: [] });

    var headers = data[0];
    var rows = [];
    for (var i = 1; i < data.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) row[headers[j]] = data[i][j];
      if (agentId && String(row.agent_id).trim() !== String(agentId).trim()) continue;
      if (!includeHidden) {
        var isActive = row.active === true || String(row.active).toUpperCase() === 'TRUE';
        if (!isActive) continue;
      }
      rows.push(row);
    }
    return jsonResponse({ success: true, data: rows });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function handleCreate(data, agentId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Listings');
    if (!sheet) {
      sheet = ss.insertSheet('Listings');
      sheet.appendRow(['agent_id', 'id', 'name', 'district', 'metro', 'price_from', 'price_to', 'rooms', 'area_min', 'area_max', 'price_per_sqm', 'completion_soonest', 'status', 'completion_all', 'class', 'finishing', 'description', 'image_main', 'image_gallery', 'floor_plans_text', 'floor_plans_images', 'features', 'address', 'lat', 'lng', 'active']);
    }
    var id = 'obj-' + new Date().getTime();
    sheet.appendRow([
      agentId, id, data.name || '', data.district || '', data.metro || '',
      data.price_from || '', data.price_to || '', data.rooms || '',
      data.area_min || '', data.area_max || '', data.price_per_sqm || '',
      data.completion_soonest || '', data.status || '', data.completion_all || '',
      data.class || '', data.finishing || '', data.description || '',
      data.image_main || '', data.images_gallery || '', '',
      data.floor_plans_images || '', data.features || '', data.address || '',
      data.lat || '', data.lng || '', data.active === true ? 'TRUE' : 'FALSE'
    ]);
    return jsonResponse({ success: true, id: id });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function handleUpdate(data, agentId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Listings');
    if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ success: false, error: 'Объект не найден' });

    var sheetData = sheet.getDataRange().getValues();
    var headers = sheetData[0];
    var idIdx = headers.indexOf('id');
    var updated = false;

    for (var i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][idIdx]) === String(data.id)) {
        var row = i + 1;
        if (data.name) sheet.getRange(row, headers.indexOf('name') + 1).setValue(data.name);
        if (data.address) sheet.getRange(row, headers.indexOf('address') + 1).setValue(data.address);
        if (data.district) sheet.getRange(row, headers.indexOf('district') + 1).setValue(data.district);
        if (data.metro) sheet.getRange(row, headers.indexOf('metro') + 1).setValue(data.metro);
        if (data.price_from !== undefined) sheet.getRange(row, headers.indexOf('price_from') + 1).setValue(data.price_from);
        if (data.price_to !== undefined) sheet.getRange(row, headers.indexOf('price_to') + 1).setValue(data.price_to);
        if (data.rooms) sheet.getRange(row, headers.indexOf('rooms') + 1).setValue(data.rooms);
        if (data.area_min !== undefined) sheet.getRange(row, headers.indexOf('area_min') + 1).setValue(data.area_min);
        if (data.area_max !== undefined) sheet.getRange(row, headers.indexOf('area_max') + 1).setValue(data.area_max);
        if (data.price_per_sqm !== undefined) sheet.getRange(row, headers.indexOf('price_per_sqm') + 1).setValue(data.price_per_sqm);
        if (data.completion_soonest) sheet.getRange(row, headers.indexOf('completion_soonest') + 1).setValue(data.completion_soonest);
        if (data.completion_all) sheet.getRange(row, headers.indexOf('completion_all') + 1).setValue(data.completion_all);
        if (data.class) sheet.getRange(row, headers.indexOf('class') + 1).setValue(data.class);
        if (data.finishing) sheet.getRange(row, headers.indexOf('finishing') + 1).setValue(data.finishing);
        if (data.status) sheet.getRange(row, headers.indexOf('status') + 1).setValue(data.status);
        if (data.description !== undefined) sheet.getRange(row, headers.indexOf('description') + 1).setValue(data.description);
        if (data.features !== undefined) sheet.getRange(row, headers.indexOf('features') + 1).setValue(data.features);
        if (data.image_main !== undefined) sheet.getRange(row, headers.indexOf('image_main') + 1).setValue(data.image_main);
        if (data.images_gallery !== undefined) sheet.getRange(row, headers.indexOf('image_gallery') + 1).setValue(data.images_gallery);
        if (data.floor_plans_images !== undefined) sheet.getRange(row, headers.indexOf('floor_plans_images') + 1).setValue(data.floor_plans_images);
        if (data.lat !== undefined) sheet.getRange(row, headers.indexOf('lat') + 1).setValue(data.lat);
        if (data.lng !== undefined) sheet.getRange(row, headers.indexOf('lng') + 1).setValue(data.lng);
        if (data.active !== undefined) sheet.getRange(row, headers.indexOf('active') + 1).setValue(data.active ? 'TRUE' : 'FALSE');
        updated = true;
        break;
      }
    }
    if (!updated) return jsonResponse({ success: false, error: 'Объект не найден' });
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function handleDelete(data, agentId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Listings');
    if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ success: false, error: 'Объект не найден' });

    var sheetData = sheet.getDataRange().getValues();
    var headers = sheetData[0];
    var idIdx = headers.indexOf('id');

    for (var i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][idIdx]) === String(data.id)) {
        sheet.deleteRow(i + 1);
        return jsonResponse({ success: true });
      }
    }
    return jsonResponse({ success: false, error: 'Объект не найден' });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

// === БИЗНЕС-ЛОГИКА: ЗАЯВКИ (LEADS) ===

function saveLead(data, agentId, chatId) {
  try {
    var phone = String(data.clientPhone || '').replace(/[^\d+]/g, '');
    var cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 11 || cleanPhone[0] !== '7') {
      return jsonResponse({ success: false, error: 'Неверный формат телефона. Должно быть: +7 (XXX) XXX-XX-XX' });
    }
    var fakeNumbers = ['70000000000', '79999999999', '71111111111', '77777777777', '78888888888'];
    if (fakeNumbers.indexOf(cleanPhone) !== -1) {
      return jsonResponse({ success: false, error: 'Пожалуйста, введите реальный номер телефона' });
    }
    var name = String(data.clientName || '').trim();
    if (name.length < 2) {
      return jsonResponse({ success: false, error: 'Введите имя (минимум 2 символа)' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Leads');
    if (!sheet) {
      sheet = ss.insertSheet('Leads');
      sheet.appendRow(['agent_id', 'id', 'timestamp', 'objectName', 'clientName', 'clientPhone', 'clientTelegram', 'status']);
    }

    var id = 'lead-' + new Date().getTime();
    var timestamp = new Date().toISOString();

    sheet.appendRow([
      agentId, id, timestamp,
      String(data.objectName || ''), name, cleanPhone,
      String(data.clientTelegram || 'Не указан'), 'Новая'
    ]);

    if (chatId) {
      try {
        sendTelegramNotification({
          chatId: chatId,
          objectName: data.objectName,
          clientName: name,
          clientPhone: '+' + cleanPhone,
          clientTelegram: data.clientTelegram || 'Не указан'
        });
      } catch (notifyError) {
        Logger.log('❌ Notification error: ' + notifyError.toString());
      }
    }
    return jsonResponse({ success: true, id: id });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function getLeads(agentId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Leads');
    if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ success: true, data: [] });

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var leads = [];
    for (var i = 1; i < data.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) row[headers[j]] = data[i][j];
      if (row.timestamp) row.formattedTime = formatDate(row.timestamp);
      if (String(row.agent_id).trim() === String(agentId).trim()) leads.push(row);
    }
    leads.sort(function(a, b) {
      var dateA = parseDateFromSheet(a.timestamp);
      var dateB = parseDateFromSheet(b.timestamp);
      return dateB - dateA;
    });
    return jsonResponse({ success: true, data: leads });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function updateLeadStatus(leadId, status, agentId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Leads');
    if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ success: false, error: 'Заявка не найдена' });

    var sheetData = sheet.getDataRange().getValues();
    var headers = sheetData[0];
    var idIdx = headers.indexOf('id');
    var statusIdx = headers.indexOf('status');
    var statusMap = { 'new': 'Новая', 'contacted': 'Обзвонена', 'completed': 'Завершена', 'cancelled': 'Отменена' };

    for (var i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][idIdx]) === String(leadId)) {
        sheet.getRange(i + 1, statusIdx + 1).setValue(statusMap[status] || status);
        return jsonResponse({ success: true });
      }
    }
    return jsonResponse({ success: false, error: 'Заявка не найдена' });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

// === БИЗНЕС-ЛОГИКА: АГЕНТЫ И СТРАНИЦЫ ===

function getAgentConfig(agentId, userId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var agentsSheet = ss.getSheetByName('Agents');
    if (!agentsSheet || agentsSheet.getLastRow() < 2) return jsonResponse({ success: false, error: 'Агенты не настроены' });

    var data = agentsSheet.getDataRange().getValues();
    var headers = data[0];
    for (var i = 1; i < data.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) row[headers[j]] = data[i][j];
      if (String(row.agent_id).trim() === String(agentId).trim()) {
        return jsonResponse({
          success: true,
          agentId: row.agent_id,
          name: row.name,
          config: JSON.parse(row.brand_config || '{}'),
          isOwner: String(row.telegram_user_id) === String(PropertiesService.getScriptProperties().getProperty('PLATFORM_OWNER_TELEGRAM_ID') || '')
        });
      }
    }
    return jsonResponse({ success: false, error: 'Агент не найден' });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function resolveAgentByDomain(domain) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var agentsSheet = ss.getSheetByName('Agents');
    if (!agentsSheet || agentsSheet.getLastRow() < 2) return jsonResponse({ success: false, error: 'Агенты не настроены' });

    var data = agentsSheet.getDataRange().getValues();
    var headers = data[0];
    var domainIdx = headers.indexOf('custom_domain');
    var idIdx = headers.indexOf('agent_id');
    if (domainIdx === -1 || idIdx === -1) return jsonResponse({ success: false, error: 'Колонки не найдены' });

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][domainIdx]).trim() === String(domain).trim()) {
        return jsonResponse({ success: true, agentId: data[i][idIdx] });
      }
    }
    return jsonResponse({ success: false, error: 'Домен не найден' });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function verifyPin(agentId, pin) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var agentsSheet = ss.getSheetByName('Agents');
    if (!agentsSheet || agentsSheet.getLastRow() < 2) return jsonResponse({ success: false, error: 'Агенты не настроены' });

    var data = agentsSheet.getDataRange().getValues();
    var headers = data[0];
    var idIdx = headers.indexOf('agent_id');
    var hashIdx = headers.indexOf('pin_hash');
    if (idIdx === -1 || hashIdx === -1) return jsonResponse({ success: false, error: 'Колонки не найдены' });

    var inputHash = hashPin(pin);
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]).trim() === String(agentId).trim()) {
        if (String(data[i][hashIdx] || '').trim() === inputHash) return jsonResponse({ success: true, agentId: agentId });
        break;
      }
    }
    return jsonResponse({ success: false, error: 'Неверный PIN-код' });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function changeAgentPin(agentId, oldPin, newPin) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var agentsSheet = ss.getSheetByName('Agents');
    if (!agentsSheet || agentsSheet.getLastRow() < 2) return jsonResponse({ success: false, error: 'Агент не найден' });

    var data = agentsSheet.getDataRange().getValues();
    var headers = data[0];
    var idIdx = headers.indexOf('agent_id');
    var hashIdx = headers.indexOf('pin_hash');

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]).trim() === String(agentId).trim()) {
        if (String(data[i][hashIdx] || '').trim() !== hashPin(oldPin)) return jsonResponse({ success: false, error: 'Неверный текущий PIN' });
        agentsSheet.getRange(i + 1, hashIdx + 1).setValue(hashPin(newPin));
        return jsonResponse({ success: true });
      }
    }
    return jsonResponse({ success: false, error: 'Агент не найден' });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function getAgentProfile(agentId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('AgentData');
    if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ success: true, data: {} });

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    for (var i = 1; i < data.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) row[headers[j]] = data[i][j];
      if (String(row.agent_id).trim() === String(agentId).trim()) return jsonResponse({ success: true, data: row });
    }
    return jsonResponse({ success: true, data: {} });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function updateAgentProfile(data, agentId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('AgentData');
    if (!sheet) {
      sheet = ss.insertSheet('AgentData');
      sheet.appendRow(['agent_id', 'name', 'role', 'agencyName', 'agencyAddress', 'telegramUsername', 'phone', 'photoUrl']);
    }
    var sheetData = sheet.getDataRange().getValues();
    var headers = sheetData[0];
    var agentIdx = headers.indexOf('agent_id');
    var row = -1;
    for (var i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][agentIdx]) === String(agentId)) { row = i + 1; break; }
    }
    if (row === -1) {
      sheet.appendRow([agentId, data.name || '', data.role || '', data.agencyName || '', data.agencyAddress || '', data.telegramUsername || '', data.phone || '', data.photoUrl || '']);
    } else {
      sheet.getRange(row, headers.indexOf('name') + 1).setValue(data.name);
      sheet.getRange(row, headers.indexOf('role') + 1).setValue(data.role);
      sheet.getRange(row, headers.indexOf('agencyName') + 1).setValue(data.agencyName);
      sheet.getRange(row, headers.indexOf('agencyAddress') + 1).setValue(data.agencyAddress);
      sheet.getRange(row, headers.indexOf('telegramUsername') + 1).setValue(data.telegramUsername);
      sheet.getRange(row, headers.indexOf('phone') + 1).setValue(data.phone);
      sheet.getRange(row, headers.indexOf('photoUrl') + 1).setValue(data.photoUrl);
    }
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function getPagesData(agentId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Pages');
    if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ success: true, data: [] });

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var pages = [];
    for (var i = 1; i < data.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) row[headers[j]] = data[i][j];
      if (String(row.agent_id).trim() === String(agentId).trim()) pages.push(row);
    }
    return jsonResponse({ success: true, data: pages });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function updatePage(page, title, content, agentId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Pages');
    if (!sheet) {
      sheet = ss.insertSheet('Pages');
      sheet.appendRow(['agent_id', 'page', 'title', 'content']);
    }
    var sheetData = sheet.getDataRange().getValues();
    var headers = sheetData[0];
    var agentIdx = headers.indexOf('agent_id');
    var pageIdx = headers.indexOf('page');
    var row = -1;
    for (var i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][agentIdx]) === String(agentId) && String(sheetData[i][pageIdx]) === String(page)) { row = i + 1; break; }
    }
    if (row === -1) {
      sheet.appendRow([agentId, page, title, content]);
    } else {
      sheet.getRange(row, headers.indexOf('title') + 1).setValue(title);
      sheet.getRange(row, headers.indexOf('content') + 1).setValue(content);
    }
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

// === ЗАГРУЗКА ФОТО И УВЕДОМЛЕНИЯ ===

function uploadImage(data, agentId) {
  try {
    var base64 = data.image;
    var fileName = data.fileName || 'image-' + new Date().getTime();
    var encoded = base64.split(',').pop();
    var blob = Utilities.newBlob(Utilities.base64Decode(encoded), 'image/jpeg', fileName);
    var folder = DriveApp.getFoldersByName('Realty Images').hasNext() ? DriveApp.getFoldersByName('Realty Images').next() : DriveApp.createFolder('Realty Images');
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId = file.getId();
    var directUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
    PropertiesService.getScriptProperties().setProperty('last_uploaded_file_url', directUrl);
    return jsonResponse({ success: true, url: directUrl, id: fileId });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function getLastFileUrl() {
  try {
    var url = PropertiesService.getScriptProperties().getProperty('last_uploaded_file_url') || '';
    return jsonResponse({ success: true, url: url });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function sendTelegramNotification(data) {
  try {
    var token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_NOTIFICATION_BOT_TOKEN');
    if (!token) return;
    var chatId = data.chatId;
    if (!chatId) return;

    var message = '🔔 Новая заявка!\n\n';
    message += '🏢 Объект: ' + (data.objectName || 'Не указан') + '\n';
    message += '👤 Имя: ' + (data.clientName || 'Не указан') + '\n';
    message += '📞 Телефон: ' + (data.clientPhone || 'Не указан');
    if (data.clientTelegram && data.clientTelegram !== 'Не указан') message += '\n💬 Telegram: ' + data.clientTelegram;

    var url = 'https://api.telegram.org/bot' + token + '/sendMessage';
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
    });
  } catch (e) {
    Logger.log('[sendTelegramNotification] Error: ' + e.toString());
  }
}

function processTelegramWebhook(e) {
  try {
    var update = JSON.parse(e.postData.contents);
    if (update.message && update.message.text === '/start') {
      var token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_NOTIFICATION_BOT_TOKEN');
      if (!token) return jsonResponse({ ok: false, error: 'Token not found' });
      UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          chat_id: update.message.chat.id,
          text: '👋 Привет! Бот подключен к каталогу новостроек.\n\nТы будешь получать уведомления о новых заявках.'
        })
      });
    }
    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ ok: false, error: e.toString() });
  }
}
