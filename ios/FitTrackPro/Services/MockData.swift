import Foundation

enum MockData {
    static func samplePlan(startDayIndex: Int = 0, daysUnlocked: Int = 3) -> TrainingPlan {
        let days: [(String, String)] = [
            ("Lunes", "Empuje (Pecho/Hombro/Tríceps)"),
            ("Martes", "Jalón (Espalda/Bíceps)"),
            ("Miércoles", "Pierna"),
            ("Jueves", "Descanso activo"),
            ("Viernes", "Full Body"),
            ("Sábado", "Cardio + Core"),
            ("Domingo", "Descanso")
        ]
        let planDays = days.map { (dia, tipo) -> PlanDay in
            let entrenamiento = Entrenamiento(
                tipo: tipo,
                calentamiento: [Calentamiento(nombre: "Bici estática", duracion: "5 min"), Calentamiento(nombre: "Movilidad articular", duracion: "3 min")],
                ejercicios: tipo == "Descanso" ? [] : [
                    PlanEjercicio(nombre: "Press banca", series: 4, reps: "8-10", nota: nil),
                    PlanEjercicio(nombre: "Sentadilla", series: 4, reps: "6-8", nota: "Controla el descenso"),
                    PlanEjercicio(nombre: "Remo con barra", series: 3, reps: "10-12", nota: nil),
                    PlanEjercicio(nombre: "Plancha", series: 3, reps: "45s", nota: nil)
                ]
            )
            let dieta = DietaDia(
                kcal: 2200, proteina: 165, carbs: 220, grasas: 65,
                comidas: [
                    Comida(momento: "Desayuno", descripcion: "Omelette de 3 claras + 1 huevo, avena con fruta"),
                    Comida(momento: "Comida", descripcion: "Pechuga de pollo 200g, arroz 1 taza, ensalada"),
                    Comida(momento: "Merienda", descripcion: "Yogur griego con nueces"),
                    Comida(momento: "Cena", descripcion: "Salmón 180g, vegetales al vapor")
                ]
            )
            return PlanDay(dia: dia, entrenamiento: entrenamiento, dieta: dieta)
        }
        return TrainingPlan(plan: planDays, daysUnlocked: daysUnlocked, startDayIndex: startDayIndex)
    }

    static func sampleLogs(userId: String, userName: String) -> [LogEntry] {
        let cal = Calendar.current
        return (0..<10).map { i -> LogEntry in
            let date = cal.date(byAdding: .day, value: -i, to: Date()) ?? Date()
            let isMeal = i % 2 == 0
            return LogEntry(
                userId: userId, userName: userName,
                type: isMeal ? .meal : .workout,
                content: isMeal ? "Pollo con arroz y ensalada" : "Rutina de empuje completada",
                aiMetadata: isMeal
                    ? AIMetadata(kcal: 620, protein: 48, carbs: 55, fats: 18, name: "Pollo con arroz")
                    : AIMetadata(volume: 4200, projected1RM: 92),
                timestamp: date
            )
        }
    }

    static func samplePhotos(userId: String) -> [PhotoEntry] {
        let categories = ["Fotos iniciales", "Avance 1 mes", "Avance 2 meses"]
        return categories.enumerated().map { idx, cat in
            PhotoEntry(userId: userId, url: "photo_placeholder_\(idx)", category: cat, createdAt: Date().addingTimeInterval(Double(-idx) * 86400 * 30))
        }
    }

    static func sampleMessages(userId: String, coachName: String) -> [AppChatMessage] {
        [
            AppChatMessage(userId: userId, coachName: coachName, text: "¡Bienvenido/a a FitTrack Pro! Cualquier duda, aquí estoy 💪", createdAt: Date().addingTimeInterval(-86400 * 3), read: true, isFromCoach: true),
            AppChatMessage(userId: userId, text: "Gracias coach! ya empecé el plan de esta semana", createdAt: Date().addingTimeInterval(-86400 * 2), read: true, isFromCoach: false),
            AppChatMessage(userId: userId, coachName: coachName, text: "Excelente, recuerda registrar tus comidas para ajustar macros 🔥", createdAt: Date().addingTimeInterval(-3600 * 5), read: false, isFromCoach: true)
        ]
    }

    static func sampleClients(coachId: String) -> [CoachClientSummary] {
        let names = ["Ana Torres", "Luis Ramírez", "María Gómez", "Carlos Ruiz", "Sofía Herrera"]
        return names.enumerated().map { idx, name in
            CoachClientSummary(
                id: "client_\(idx)",
                name: name,
                email: name.lowercased().replacingOccurrences(of: " ", with: ".") + "@demo.com",
                goals: Goals(name: name, age: 24 + idx, objective: Objective.allCases[idx % Objective.allCases.count]),
                planStatus: idx == 1 ? "pending" : "active",
                coachDeadline: idx == 1 ? Date().addingTimeInterval(3600 * 18) : nil,
                modalidad: .coach,
                premium: idx % 2 == 0,
                lastOpenTimestamp: Date().addingTimeInterval(Double(-idx) * 3600 * 4),
                coachNotes: idx == 0 ? "Progresando muy bien, subir volumen la próxima semana." : nil,
                photoRequest: nil,
                meetLink: nil,
                createdAt: Date().addingTimeInterval(Double(-idx) * 86400 * 20)
            )
        }
    }

    static func sampleClientMetrics(seed: Int) -> CoachClientMetrics {
        CoachClientMetrics(
            racha: 3 + seed,
            adherenciaSemana: 60 + (seed * 7) % 40,
            ultimoAcceso: Date().addingTimeInterval(Double(-seed) * 3600),
            ejerciciosCompletadosHoy: 3,
            totalEjerciciosHoy: 4,
            comidasRegistradasHoy: 2,
            totalComidasHoy: 4,
            kcalRegistradas: 1240,
            kcalMeta: 2200,
            actividadSemana: (0..<7).map { _ in Int.random(in: 0...1) },
            pesos: (0..<6).map { 78 - Double($0) * 0.4 },
            totalLogs: 20 + seed
        )
    }

    static func sampleCoachDashboardMetrics() -> CoachDashboardMetrics {
        CoachDashboardMetrics(totalClientes: 5, activos: 4, pendientes: 1, entrenaronHoy: 3, registraronComidaHoy: 4, sinActividad: 1, adherenciaPromedio: 76)
    }

    static func sampleAdminMetrics() -> AdminMetrics {
        let cal = Calendar.current
        let signups = (0..<14).map { i -> DailyPoint in
            let date = cal.date(byAdding: .day, value: -13 + i, to: Date()) ?? Date()
            return DailyPoint(date: DateFormatter.shortDate.string(from: date), value: Int.random(in: 2...18))
        }
        let conversions = (0..<14).map { i -> DailyPoint in
            let date = cal.date(byAdding: .day, value: -13 + i, to: Date()) ?? Date()
            return DailyPoint(date: DateFormatter.shortDate.string(from: date), value: Int.random(in: 0...5))
        }
        return AdminMetrics(
            totalUsers: 842, premiumUsers: 231, freeUsers: 611, activePlanUsers: 690, noPlanUsers: 152,
            totalCoaches: 12, newToday: 9, signupsSeries: signups, premiumConversionsSeries: conversions,
            objectiveDistribution: [
                Objective.perdidaGrasa.rawValue: 340,
                Objective.gananciaMuscular.rawValue: 260,
                Objective.recomposicion.rawValue: 180,
                Objective.mantenimiento.rawValue: 62
            ]
        )
    }

    static func sampleCoaches() -> [CoachSummary] {
        [
            CoachSummary(id: "coach_1", name: "Coach Ivan", email: "coach@demo.com", coachCode: "IVAN482", premium: true, clientCount: 5, createdAt: Date().addingTimeInterval(-86400 * 200)),
            CoachSummary(id: "coach_2", name: "Coach Fer", email: "fer.coach@demo.com", coachCode: "FER117", premium: true, clientCount: 12, createdAt: Date().addingTimeInterval(-86400 * 90))
        ]
    }

    static func sampleCoachRequests() -> [CoachRequest] {
        [
            CoachRequest(id: "req_1", nombre: "Diana Salas", email: "diana.salas@mail.com", telefono: "5512345678", especialidad: "Nutrición deportiva", experiencia: "6 años en gimnasios y online coaching", status: .pending, createdAt: Date().addingTimeInterval(-3600 * 20)),
            CoachRequest(id: "req_2", nombre: "Jorge Peña", email: "jorge.pena@mail.com", telefono: "5598765432", especialidad: "Fuerza e hipertrofia", experiencia: "Entrenador certificado NSCA, 4 años", status: .pending, createdAt: Date().addingTimeInterval(-3600 * 5))
        ]
    }
}

extension DateFormatter {
    static let shortDate: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "d MMM"
        f.locale = Locale(identifier: "es_MX")
        return f
    }()
}
