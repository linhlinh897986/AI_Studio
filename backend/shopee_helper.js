const axios = require('axios');

/**
 * Resolve Shopee short links to full URLs
 * @param {string} url 
 * @returns {Promise<string>}
 */
async function resolveShopeeUrl(url) {
  if (url.includes('shope.ee')) {
    try {
      const response = await axios.get(url, {
        maxRedirects: 10,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      return response.request.res.responseUrl || url;
    } catch (e) {
      console.error('Error resolving short URL:', e.message);
      // Fallback: try head request
      try {
        const headResp = await axios.head(url, { maxRedirects: 10 });
        return headResp.headers.location || url;
      } catch (err) {
        return url;
      }
    }
  }
  return url;
}

/**
 * Parse Shop ID and Item ID from Shopee URL
 * @param {string} url 
 * @returns {{shopId: string, itemId: string}}
 */
function parseShopeeIds(url) {
  // Pattern 1: -i.SHOP_ID.ITEM_ID
  const match1 = url.match(/i\.(\d+)\.(\d+)/);
  if (match1) {
    return { shopId: match1[1], itemId: match1[2] };
  }
  // Pattern 2: product/SHOP_ID/ITEM_ID
  const match2 = url.match(/product\/(\d+)\/(\d+)/);
  if (match2) {
    return { shopId: match2[1], itemId: match2[2] };
  }
  throw new Error("Không thể trích xuất Shop ID và Item ID từ liên kết Shopee này. Định dạng không hợp lệ.");
}

/**
 * Fetch Product Details from Shopee API
 * @param {string} shopeeLink 
 * @returns {Promise<object>}
 */
async function fetchShopeeProduct(shopeeLink) {
  const resolvedUrl = await resolveShopeeUrl(shopeeLink);
  const { shopId, itemId } = parseShopeeIds(resolvedUrl);

  const apiUrl = `https://shopee.vn/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`;
  
  const response = await axios.get(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://shopee.vn/'
    }
  });

  if (response.data && response.data.error) {
    throw new Error(`Shopee API error: ${response.data.error_msg || response.data.error}`);
  }

  const item = response.data.data;
  if (!item) {
    throw new Error("Không tìm thấy thông tin sản phẩm từ Shopee.");
  }

  const images = (item.images || []).map(hash => `https://down-vn.img.susercontent.com/file/${hash}`);
  
  // Shopee prices are usually multiplied by 100,000
  const formatPrice = (p) => {
    if (!p) return 0;
    return Math.floor(p / 100000);
  };

  return {
    title: item.name,
    description: item.description,
    images: images,
    price: formatPrice(item.price),
    priceMin: formatPrice(item.price_min),
    priceMax: formatPrice(item.price_max),
    ratingStar: item.item_rating ? item.item_rating.rating_star : 5.0,
    historicalSold: item.historical_sold || 0,
    currency: item.currency || "VND",
    shopId,
    itemId,
    url: resolvedUrl
  };
}

module.exports = {
  fetchShopeeProduct
};
