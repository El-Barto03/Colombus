UPDATE `shops`
SET `directions_url` = 'https://www.google.com/maps/dir/?api=1&destination=' || `lat` || ',' || `lng`
WHERE trim(`directions_url`) = '';
