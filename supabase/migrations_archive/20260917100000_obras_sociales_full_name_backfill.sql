-- Completa full_name para 30 obras sociales cuyo `name` es una sigla,
-- verificado contra fuentes oficiales (SSSalud, RNOS, Boletín Oficial, sitios
-- institucionales). No se tocan las entidades que ya son marca/nombre
-- completo (quedan con full_name null a propósito) ni las siglas sindicales
-- que no se pudieron verificar con una fuente confiable.
--
-- Recuperado del PR #18 (cerrado sin mergear, superado por #14): estos datos
-- ya se habían aplicado directo contra producción (pvuaqatdendcgumwktid)
-- antes de que el PR llegara a existir siquiera, y el commit correspondiente
-- nunca se mergeó a main. Este archivo solo sincroniza el repo con lo que ya
-- está en la base — son puros UPDATE de datos, idempotentes (reescriben el
-- mismo valor si ya está seteado), no rompen si se corren de nuevo.

update obras_sociales set full_name = 'Asociart S.A. Aseguradora de Riesgos del Trabajo' where name = 'Asociart';
update obras_sociales set full_name = 'Experta Aseguradora de Riesgos del Trabajo S.A.' where name = 'Experta ART';
update obras_sociales set full_name = 'Galeno Aseguradora de Riesgos del Trabajo S.A.' where name = 'Galeno ART';
update obras_sociales set full_name = 'Prevención Aseguradora de Riesgos del Trabajo S.A.' where name = 'Prevención ART';
update obras_sociales set full_name = 'Provincia Aseguradora de Riesgos del Trabajo S.A.' where name = 'Provincia ART';
update obras_sociales set full_name = 'Centro de Educación Médica e Investigaciones Clínicas "Norberto Quirno"' where name = 'CEMIC';
update obras_sociales set full_name = 'Organización de Servicios Directos Empresarios' where name = 'OSDE';
update obras_sociales set full_name = 'Obra Social de Empresarios, Profesionales y Monotributistas' where name = 'OSDEPYM';
update obras_sociales set full_name = 'Swiss Medical S.A.' where name = 'Swiss Medical';
update obras_sociales set full_name = 'Instituto Autárquico Provincial de Obra Social' where name = 'IAPOS - Santa Fe';
update obras_sociales set full_name = 'Instituto Provincial del Seguro Médico' where name = 'IPROSS - Río Negro';
update obras_sociales set full_name = 'Instituto de Previsión Social' where name = 'IPS - Misiones';
update obras_sociales set full_name = 'Obra Social de la Ciudad de Buenos Aires' where name = 'ObSBA - Obra Social de Buenos Aires';
update obras_sociales set full_name = 'Obra Social de Empleados Públicos' where name = 'OSEP - Mendoza';
update obras_sociales set full_name = 'Asociación Mutual de Farmacéuticos Florentino Ameghino' where name = 'AMFFA';
update obras_sociales set full_name = 'Administración Provincial del Seguro de Salud' where name = 'APROSS';
update obras_sociales set full_name = 'Dirección de Asistencia Social del Personal Universitario (UNC)' where name = 'DASPU - UNC';
update obras_sociales set full_name = 'Obra Social del Personal de la Universidad Nacional de la Patagonia San Juan Bosco' where name = 'DASU';
update obras_sociales set full_name = 'Dirección de Acción Social de la Universidad Tecnológica Nacional' where name = 'DASUTEN';
update obras_sociales set full_name = 'Instituto de Obra Médico Asistencial' where name = 'IOMA';
update obras_sociales set full_name = 'Instituto de Obra Social de las Fuerzas Armadas y de Seguridad' where name = 'IOSFA';
update obras_sociales set full_name = 'Instituto Nacional de Servicios Sociales para Jubilados y Pensionados (INSSJP)' where name = 'PAMI';
update obras_sociales set full_name = 'Unión del Personal Civil de la Nación' where name = 'UPCN Salud';
update obras_sociales set full_name = 'Obra Social de la Actividad Minera' where name = 'OSAM';
update obras_sociales set full_name = 'Obra Social de Choferes de Camiones' where name = 'OSCHOCA - Camioneros';
update obras_sociales set full_name = 'Obra Social de Petroleros' where name = 'OSPE - Petroleros';
update obras_sociales set full_name = 'Obra Social del Personal de la Construcción' where name = 'OSPECON - Construir Salud';
update obras_sociales set full_name = 'Obra Social del Personal de la Industria de la Alimentación' where name = 'OSPIA - Alimentación';
update obras_sociales set full_name = 'TPC Compañía de Seguros S.A.' where name = 'TPC Compañía de Seguros';
update obras_sociales set full_name = 'Obra Social de la Unión Obrera Metalúrgica de la República Argentina (OSUOMRA)' where name = 'UOM - Forjar Salud';
