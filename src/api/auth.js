import api from "./index";

export const getIndustries = async () => {
  try {
    const response = await api.get("/users/industries/");
    return response.data.results;
  } catch (error) {
    return Promise.reject(error.response ? error.response.data : error.message);
  }
};

export const getSubscriptionPlans = async () => {
  try {
    const response = await api.get("/users/subscription-plans/");
    return response.data.results;
  } catch (error) {
    return Promise.reject(error.response ? error.response.data : error.message);
  }
};

// Маппинг секторов на их специфичные permissions
const getSectorPermissions = (sectorName) => {
  const sectorPermissions = {
    Барбершоп: [
      "can_view_barber_clients",
      "can_view_barber_services",
      "can_view_barber_history",
      "can_view_barber_records",
    ],
    Гостиница: [
      "can_view_hostel_rooms",
      "can_view_hostel_booking",
      "can_view_hostel_clients",
      "can_view_hostel_analytics",
    ],
    Школа: [
      "can_view_school_students",
      "can_view_school_groups",
      "can_view_school_lessons",
      "can_view_school_teachers",
      "can_view_school_leads",
      "can_view_school_invoices",
    ],
    Магазин: [
      // Магазин использует базовые permissions
    ],
    Кафе: [
      "can_view_cafe_menu",
      "can_view_cafe_orders",
      "can_view_cafe_purchasing",
      "can_view_cafe_booking",
      "can_view_cafe_clients",
      "can_view_cafe_tables",
    ],
    "Строительная компания": [
      "can_view_building_work_process",
      "can_view_building_objects",
    ],
    "Ремонтные и отделочные работы": [
      "can_view_building_work_process",
      "can_view_building_objects",
    ],
    "Архитектура и дизайн": [
      "can_view_building_work_process",
      "can_view_building_objects",
    ],
  };

  return sectorPermissions[sectorName] || [];
};

// Функция для установки permissions пользователя
export const updateUserPermissions = async (userId, permissions) => {
  try {
    // Сначала пробуем обновить через profile endpoint
    const response = await api.patch(`/users/profile/`, permissions);
    return response.data;
  } catch (error) {
    // Если не получилось через profile, пробуем через employees
    try {
      const response = await api.patch(
        `/users/employees/${userId}/`,
        permissions
      );
      return response.data;
    } catch (employeesError) {
      return Promise.reject(error.response?.data || error.message);
    }
  }
};

export const registerUser = async (userData) => {
  try {
    const indt = await getIndustries();
    const subcrb = await getSubscriptionPlans();
    // console.log('dasd', { ...userData });
    const response = await api.post("/users/auth/register/", { ...userData });
    // console.log(response,'res res res');

    // Если регистрация успешна, устанавливаем permissions для сектора
    if (response.data && (response.data.user_id || response.data.id)) {
      try {
        const userId = response.data.user_id || response.data.id;

        // Получаем информацию о секторе из industries
        const selectedIndustry = indt.find((industry) =>
          industry.sectors.some(
            (sector) => sector.id === userData.company_sector_id
          )
        );

        if (selectedIndustry) {
          const selectedSector = selectedIndustry.sectors.find(
            (sector) => sector.id === userData.company_sector_id
          );

          if (selectedSector) {
            // Получаем профиль пользователя, чтобы проверить роль
            try {
              const profileResponse = await api.get("/users/profile/");
              const userProfile = profileResponse.data;

              // Устанавливаем секторные permissions только для владельца
              if (userProfile && userProfile.role_display === "Владелец") {
                const sectorPermissions = getSectorPermissions(
                  selectedSector.name
                );

                // Создаем объект permissions для PATCH запроса
                const permissionsPayload = {};
                sectorPermissions.forEach((permission) => {
                  permissionsPayload[permission] = true;
                });

                // Устанавливаем permissions для пользователя
                if (Object.keys(permissionsPayload).length > 0) {
                  // Небольшая задержка, чтобы убедиться, что пользователь создан
                  setTimeout(async () => {
                    try {
                      await updateUserPermissions(userId, permissionsPayload);
                      console.log(
                        "Sector permissions set successfully for owner:",
                        permissionsPayload
                      );
                    } catch (delayedError) {
                      console.error(
                        "Error setting sector permissions (delayed):",
                        delayedError
                      );
                    }
                  }, 1000);
                }
              } else {
                console.log(
                  "User is not owner, skipping sector permissions setup"
                );
              }
            } catch (profileError) {
              console.error("Error fetching user profile:", profileError);
            }
          }
        }
      } catch (permissionError) {
        console.error("Error setting sector permissions:", permissionError);
        // Не прерываем регистрацию из-за ошибки permissions
      }
    }

    return response;
  } catch (error) {
    return Promise.reject(error);
  }
};

export const loginUser = async (credentials) => {
  try {
    const response = await api.post("/users/auth/login/", credentials);
    return response.data;
  } catch (error) {
    return Promise.reject(error.response ? error.response.data : error.message);
  }
};

// Функция миграции для существующих пользователей
export const migrateUserPermissions = async () => {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      console.log("No access token found, skipping migration");
      return;
    }

    // Получаем информацию о компании пользователя
    const companyResponse = await api.get("/users/company/");
    const company = companyResponse.data;

    if (!company || !company.sector) {
      console.log("No company or sector found, skipping migration");
      return;
    }

    console.log("Company sector:", company.sector.name);

    // Получаем профиль пользователя
    const profileResponse = await api.get("/users/profile/");
    const userProfile = profileResponse.data;

    if (!userProfile) {
      console.log("No user profile found, skipping migration");
      return;
    }

    console.log("User profile ID:", userProfile.id);
    console.log("User role:", userProfile.role_display);

    // Проверяем, является ли пользователь владельцем
    if (userProfile.role_display !== "Владелец") {
      console.log("User is not owner, skipping sector permissions migration");
      return { migrated: false, reason: "User is not owner" };
    }

    // Получаем permissions для сектора
    const sectorPermissions = getSectorPermissions(company.sector.name);
    console.log("Sector permissions to set:", sectorPermissions);

    if (sectorPermissions.length === 0) {
      console.log("No sector permissions to set");
      return;
    }

    // Проверяем, нужно ли обновлять permissions
    const needsUpdate = sectorPermissions.some(
      (permission) => userProfile[permission] !== true
    );

    console.log("Needs update:", needsUpdate);

    if (needsUpdate) {
      // Создаем объект permissions для PATCH запроса
      const permissionsPayload = {};
      sectorPermissions.forEach((permission) => {
        permissionsPayload[permission] = true;
      });

      console.log("Permissions payload:", permissionsPayload);

      // Обновляем permissions через profile endpoint
      try {
        await api.patch(`/users/profile/`, permissionsPayload);
        console.log(
          "User permissions migrated successfully:",
          permissionsPayload
        );
        return { migrated: true, permissions: permissionsPayload };
      } catch (updateError) {
        console.error("Failed to update user permissions:", updateError);
        return { migrated: false, error: updateError.message };
      }
    }

    return { migrated: false, reason: "Permissions already up to date" };
  } catch (error) {
    console.error("Error migrating user permissions:", error);
    return { migrated: false, error: error.message };
  }
};
