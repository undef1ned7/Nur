const BASE_URL = "https://app.nurcrm.kg/api";

export const submitAdditionalServicesRequest = async (requestData) => {
  try {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      throw new Error("Токен доступа не найден");
    }

    const response = await fetch(`${BASE_URL}/main/socialapplications/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Ошибка при отправке заявки");
    }

    return await response.json();
  } catch (error) {
    console.error(
      "Ошибка при отправке заявки на дополнительные услуги:",
      error
    );
    throw error;
  }
};

export const getAdditionalServicesList = async () => {
  try {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      throw new Error("Токен доступа не найден");
    }

    const response = await fetch(`${BASE_URL}/additional-services/list/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Ошибка при получении списка услуг");
    }

    return await response.json();
  } catch (error) {
    console.error("Ошибка при получении списка дополнительных услуг:", error);
    throw error;
  }
};

export const getAdditionalServicesRequestStatus = async (requestId) => {
  try {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      throw new Error("Токен доступа не найден");
    }

    const response = await fetch(
      `${BASE_URL}/additional-services/request/${requestId}/status/`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.detail || "Ошибка при получении статуса заявки"
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Ошибка при получении статуса заявки:", error);
    throw error;
  }
};
