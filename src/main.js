/**
 * Функция для расчета прибыли
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleProfit(purchase, _product) {
    // Находим товар в чеке по SKU
    const purchasedItem = purchase.items.find(function(item) {
        return item.sku === _product.sku;
    });
    
    // Если товар не найден в чеке, возвращаем 0
    if (!purchasedItem) return 0;

    // Рассчитываем цену продажи с учетом скидки
    if (!purchasedItem.sale_price || !_product.purchase_price) return 0;
    if (isNaN(purchasedItem.discount)) purchasedItem.discount = 0;
    const revenueSku = purchasedItem.sale_price * (1 - purchasedItem.discount / 100);
    
    // Рассчитываем прибыль
    return (revenueSku - _product.purchase_price) * purchasedItem.quantity;

}


/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    // Находим товар в чеке по SKU
    const purchasedItem = purchase.items.find(function(item) {
        return item.sku === _product.sku;
    });
    
    // Если товар не найден в чеке, возвращаем 0
    if (!purchasedItem) return 0;
    
    // Рассчитываем выручку
    if (!purchasedItem.sale_price) return 0;
    if (isNaN(purchasedItem.discount)) purchasedItem.discount = 0;
    return (purchasedItem.sale_price * (1 - purchasedItem.discount / 100) * purchasedItem.quantity);

}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // @TODO: Расчет бонуса от позиции в рейтинге
    const { profit } = seller;
    let bonusPercentage = 0;
    
    if (index === 0) {
        /// Первый продавец - 15%
        bonusPercentage = 0.15;
    } else if (index === 1 || index === 2) {
        /// Второй и третий - 10%
        bonusPercentage = 0.10;
    } else if (index < total - 1) {
        /// Четвертый и далее (кроме последнего) - 5%
        bonusPercentage = 0.05;
    }
    /// Последний продавец (index === total - 1) - 0%

    /// Возвращаем бонус, округленный до целого числа
    return seller.profit * bonusPercentage;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // @TODO: Проверка входных данных
    const { calculateProfit, calculateRevenue, calculateBonus } = options;
    if (!data || !options) {
        throw new Error('Некорректные входные данные');
    }

    // @TODO: Проверка наличия опций
    if (typeof options.calculateProfit !== 'function' || typeof options.calculateRevenue !== 'function' || typeof options.calculateBonus !== 'function' ) {
        throw new Error('Опции должны содержать функции calculateRevenue и calculateBonus');
    }

    // @TODO: Подготовка промежуточных данных для сбора статистики
    const sellersMap = {};
    const productsMap = {};
    const sellerStats = {};

    // @TODO: Индексация продавцов и товаров для быстрого доступа
    data.sellers.forEach(function(seller) {
            sellersMap[seller.id] = seller;
            sellerStats[seller.id] = {
                seller_id: seller.id,
                name: seller.first_name + ' ' + seller.last_name,
                sales_count: 0,
                revenue: 0,
                profit: 0,
                top_products: {},
                bonus: 0
            };
        });

    // Индексация товаров для быстрого доступа
    data.products.forEach(function(product) {
        productsMap[product.sku] = product;
    });
    // @TODO: Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach(function(purchase) {
        const sellerId = purchase.seller_id;
        const sellerStat = sellerStats[sellerId];
        
        if (!sellerStat) return;

        // Увеличиваем счетчик продаж
        sellerStat.sales_count += 1;

        // Обрабатываем каждый товар в чеке
        purchase.items.forEach(function(item) {
            const product = productsMap[item.sku];
            if (!product) return;

            // Рассчитываем выручку и прибыль для текущего товара
            const revenue = options.calculateRevenue(purchase, product);
            const profit = options.calculateProfit(purchase, product);


            // Обновляем статистику продавца
            sellerStat.revenue += revenue;
            sellerStat.profit += profit;

            // Обновляем информацию о топовых товарах
            if (!sellerStat.top_products[item.sku]) {
                sellerStat.top_products[item.sku] = {
                    sku: item.sku,
                    name: product.name,
                    quantity: 0,
                    revenue: 0
                };
            }
            sellerStat.top_products[item.sku].quantity += item.quantity;
            sellerStat.top_products[item.sku].revenue += revenue;
        });
    });

    // @TODO: Сортировка продавцов по прибыли
    const sortedSellers = Object.values(sellerStats).sort(function(a, b) {
        return b.profit - a.profit;
    });

    // @TODO: Назначение премий на основе ранжирования
    const totalSellers = sortedSellers.length;
    sortedSellers.forEach(function(seller, index) {
        seller.bonus = options.calculateBonus(index, totalSellers, seller);
    });

    // @TODO: Подготовка итоговой коллекции с нужными полями
    return sortedSellers.map(function(seller) {
        // Преобразование топовых товаров в массив и сортировка по выручке
        const topProducts = Object.values(seller.top_products).sort(function(a, b) {
            return b.revenue - a.revenue;
        }).slice(0, 10); // Берем топ-10 товара

        return {
            seller_id: seller.seller_id,
            name: seller.name,
            revenue: +seller.revenue.toFixed(2),
            profit: +seller.profit.toFixed(2),
            sales_count: seller.sales_count,
            top_products: topProducts,
            bonus: +seller.bonus.toFixed(2)
        };
    });
}